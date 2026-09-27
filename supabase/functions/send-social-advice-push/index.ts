import { withSupabase } from "npm:@supabase/server@^1";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY =
  "BPgVaxmvt_du_vRxrQCTmeTdtvA3MkPtqpDbQJhky2Q3E6Cnw0bCaP9WfBQ8xBIKgZnyvGaXMaA4pwRo1zF9JQU";

const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");

if (!VAPID_PRIVATE_KEY) {
  throw new Error("VAPID_PRIVATE_KEY secret is missing");
}

if (!VAPID_SUBJECT) {
  throw new Error("VAPID_SUBJECT secret is missing");
}

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export default {
  fetch: withSupabase(
    {
      auth: "secret:*",
    },

    async (req, ctx) => {
      try {
        const body = await req.json();
        const userId = body.user_id;
        const movieId = body.movie_id;

        if (!userId || !movieId) {
          return Response.json(
            {
              success: false,
              error: "user_id and movie_id are required",
            },
            {
              status: 400,
            }
          );
        }

        /*
         * 1. The discovery must still exist and remain unseen.
         * A repeated/replayed request therefore cannot produce a stale push.
         */
        const {
          data: discovery,
          error: discoveryError,
        } = await ctx.supabaseAdmin
          .from("social_advice_discovery")
          .select("user_id, movie_id, seen_at")
          .eq("user_id", userId)
          .eq("movie_id", movieId)
          .maybeSingle();

        if (discoveryError) {
          throw discoveryError;
        }

        if (!discovery || discovery.seen_at) {
          return Response.json({
            success: true,
            skipped: true,
            reason: discovery
              ? "Social advice is already seen"
              : "Social advice discovery no longer exists",
          });
        }

        /*
         * 2. The existing preference is the master switch. The new one only
         * controls this notification category; neither affects the in-app +N.
         */
        const {
          data: profile,
          error: profileError,
        } = await ctx.supabaseAdmin
          .from("profiles")
          .select(`
            id,
            notifications_enabled,
            social_advice_notifications_enabled
          `)
          .eq("id", userId)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (
          !profile?.notifications_enabled ||
          !profile?.social_advice_notifications_enabled
        ) {
          return Response.json({
            success: true,
            skipped: true,
            reason: "Social advice notifications are disabled",
          });
        }

        /*
         * 3. Movie metadata.
         */
        const {
          data: movie,
          error: movieError,
        } = await ctx.supabaseAdmin
          .from("movies")
          .select("id, title")
          .eq("id", movieId)
          .maybeSingle();

        if (movieError) {
          throw movieError;
        }

        if (!movie) {
          return Response.json({
            success: true,
            skipped: true,
            reason: "Movie no longer exists",
          });
        }

        /*
         * 4. One app-icon badge combines group activity and Social Advice.
         */
        const [pushStateResult, movieActivityCountResult] =
          await Promise.all([
            ctx.supabaseAdmin.rpc(
              "get_social_advice_push_state_for_user",
              {
                p_user_id: userId,
                p_movie_id: movieId,
              }
            ),

            ctx.supabaseAdmin
              .from("movie_activity_recipients")
              .select("activity_id", {
                count: "exact",
                head: true,
              })
              .eq("user_id", userId)
              .is("seen_at", null),
          ]);

        if (pushStateResult.error) {
          throw pushStateResult.error;
        }

        if (movieActivityCountResult.error) {
          throw movieActivityCountResult.error;
        }

        const pushState = pushStateResult.data?.[0];

        if (!pushState?.target_is_eligible) {
          return Response.json({
            success: true,
            skipped: true,
            reason: "Social advice is no longer eligible",
          });
        }

        const badgeCount =
          Number(pushState.unread_count || 0) +
          (movieActivityCountResult.count || 0);

        /*
         * 5. All active devices belonging to this user.
         */
        const {
          data: subscriptions,
          error: subscriptionsError,
        } = await ctx.supabaseAdmin
          .from("push_subscriptions")
          .select(`
            id,
            user_id,
            endpoint,
            p256dh,
            auth
          `)
          .eq("user_id", userId);

        if (subscriptionsError) {
          throw subscriptionsError;
        }

        if (!subscriptions?.length) {
          return Response.json({
            success: true,
            skipped: true,
            reason: "No push subscriptions",
          });
        }

        const payload = JSON.stringify({
          title: "Нова порада",
          body: `У «Порадах» з\u2019явився фільм «${movie.title}»`,
          url: "/app.html",
          badge_count: badgeCount,
          movie_id: movieId,
          social_advice: true,
        });

        const results = [];

        for (const subscription of subscriptions) {
          try {
            const response = await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                },
              },
              payload,
              {
                TTL: 300,
              }
            );

            results.push({
              subscription_id: subscription.id,
              user_id: subscription.user_id,
              badge_count: badgeCount,
              success: true,
              statusCode: response.statusCode,
            });
          } catch (pushError: any) {
            const statusCode = pushError?.statusCode ?? null;

            if (statusCode === 404 || statusCode === 410) {
              await ctx.supabaseAdmin
                .from("push_subscriptions")
                .delete()
                .eq("id", subscription.id);
            }

            console.error(
              "Social advice push delivery error:",
              pushError
            );

            results.push({
              subscription_id: subscription.id,
              user_id: subscription.user_id,
              badge_count: badgeCount,
              success: false,
              statusCode,
              error:
                pushError instanceof Error
                  ? pushError.message
                  : String(pushError),
            });
          }
        }

        return Response.json({
          success: true,
          user_id: userId,
          movie_id: movieId,
          badge_count: badgeCount,
          subscriptions: subscriptions.length,
          results,
        });
      } catch (error) {
        console.error("send-social-advice-push error:", error);

        return Response.json(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
          {
            status: 500,
          }
        );
      }
    }
  ),
};
