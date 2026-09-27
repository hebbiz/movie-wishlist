import { withSupabase } from "npm:@supabase/server@^1";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY =
  "BPgVaxmvt_du_vRxrQCTmeTdtvA3MkPtqpDbQJhky2Q3E6Cnw0bCaP9WfBQ8xBIKgZnyvGaXMaA4pwRo1zF9JQU";

const VAPID_PRIVATE_KEY =
  Deno.env.get("VAPID_PRIVATE_KEY");

const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT");

if (!VAPID_PRIVATE_KEY) {
  throw new Error(
    "VAPID_PRIVATE_KEY secret is missing"
  );
}

if (!VAPID_SUBJECT) {
  throw new Error(
    "VAPID_SUBJECT secret is missing"
  );
}

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

function formatStatus(status: string | null) {
  const labels: Record<string, string> = {
    wishlist: "Хочу переглянути",
    ordered: "Замовлено",
    owned: "Придбано",
    watched: "Переглянуто",
  };

  return status
    ? labels[status] || status
    : "список";
}

function formatGroupType(type: string | null) {
  const labels: Record<string, string> = {
    family: "Сімʼя",
    friends: "Друзі",
    community: "Спільнота",
  };

  return type
    ? labels[type] || type
    : "";
}

export default {
  fetch: withSupabase(
    {
      auth: "secret:*",
    },

    async (req, ctx) => {
      try {
        const body = await req.json();

        const activityId =
          body.activity_id ||
          body.record?.id;

        if (!activityId) {
          return Response.json(
            {
              success: false,
              error:
                "activity_id is required",
            },
            {
              status: 400,
            }
          );
        }

        /*
         * 1. Activity
         */
        const {
          data: activity,
          error: activityError,
        } = await ctx.supabaseAdmin
          .from("movie_activity")
          .select(`
            id,
            group_id,
            movie_id,
            actor_user_id,
            from_status,
            to_status,
            created_at
          `)
          .eq("id", activityId)
          .maybeSingle();

        if (activityError) {
          throw activityError;
        }

        if (!activity) {
          return Response.json({
            success: true,
            skipped: true,
            reason:
              "Activity no longer exists",
          });
        }

        /*
         * 2. Group
         */
        const {
          data: group,
          error: groupError,
        } = await ctx.supabaseAdmin
          .from("groups")
          .select(`
            id,
            name,
            type
          `)
          .eq(
            "id",
            activity.group_id
          )
          .maybeSingle();

        if (groupError) {
          throw groupError;
        }

        const groupType =
          formatGroupType(
            group?.type || null
          );

        const groupTitle =
          group?.name
            ? `${groupType} ${group.name}`.trim()
            : "Movie Wishlist";

        /*
         * 3. Movie
         */
        const {
          data: movie,
          error: movieError,
        } = await ctx.supabaseAdmin
          .from("movies")
          .select(`
            id,
            title
          `)
          .eq(
            "id",
            activity.movie_id
          )
          .maybeSingle();

        if (movieError) {
          throw movieError;
        }

        /*
         * 4. Actor
         */
        const {
          data: actorProfile,
          error: actorError,
        } = await ctx.supabaseAdmin
          .from("profiles")
          .select(`
            id,
            display_name,
            email
          `)
          .eq(
            "id",
            activity.actor_user_id
          )
          .maybeSingle();

        if (actorError) {
          throw actorError;
        }

        const actorName =
          actorProfile?.display_name ||
          actorProfile?.email ||
          "Хтось";

        const movieTitle =
          movie?.title ||
          "Фільм";

        /*
         * 5. Unseen recipients
         * саме цієї activity
         */
        const {
          data: recipientRows,
          error: recipientsError,
        } = await ctx.supabaseAdmin
          .from(
            "movie_activity_recipients"
          )
          .select(`
            user_id,
            seen_at
          `)
          .eq(
            "activity_id",
            activity.id
          )
          .is(
            "seen_at",
            null
          );

        if (recipientsError) {
          throw recipientsError;
        }

        if (!recipientRows?.length) {
          return Response.json({
            success: true,
            skipped: true,
            reason:
              "No unseen recipients",
          });
        }

        const recipientIds =
          recipientRows.map(
            (row) => row.user_id
          );

        /*
         * 6. Notification preference
         */
        const {
          data: recipientProfiles,
          error:
            recipientProfilesError,
        } = await ctx.supabaseAdmin
          .from("profiles")
          .select(`
            id,
            notifications_enabled
          `)
          .in(
            "id",
            recipientIds
          )
          .eq(
            "notifications_enabled",
            true
          );

        if (recipientProfilesError) {
          throw recipientProfilesError;
        }

        const enabledUserIds =
          new Set(
            (recipientProfiles || [])
              .map(
                (profile) =>
                  profile.id
              )
          );

        const pushRecipientIds =
          recipientIds.filter(
            (userId) =>
              enabledUserIds.has(
                userId
              )
          );

        if (!pushRecipientIds.length) {
          return Response.json({
            success: true,
            skipped: true,
            reason:
              "Recipients have notifications disabled",
          });
        }

        /*
         * 7. Global unseen count
         * для кожного recipient
         * по всіх його групах
         */
        const {
          data: unseenRows,
          error: unseenRowsError,
        } = await ctx.supabaseAdmin
          .from(
            "movie_activity_recipients"
          )
          .select("user_id")
          .in(
            "user_id",
            pushRecipientIds
          )
          .is(
            "seen_at",
            null
          );

        if (unseenRowsError) {
          throw unseenRowsError;
        }

        const unseenCountByUser =
          new Map<string, number>();

        for (
          const row
          of unseenRows || []
        ) {
          unseenCountByUser.set(
            row.user_id,
            (
              unseenCountByUser.get(
                row.user_id
              ) || 0
            ) + 1
          );
        }

        /*
         * 8. Push subscriptions
         */
        const {
          data: subscriptions,
          error: subscriptionsError,
        } = await ctx.supabaseAdmin
          .from(
            "push_subscriptions"
          )
          .select(`
            id,
            user_id,
            endpoint,
            p256dh,
            auth
          `)
          .in(
            "user_id",
            pushRecipientIds
          );

        if (subscriptionsError) {
          throw subscriptionsError;
        }

        if (!subscriptions?.length) {
          return Response.json({
            success: true,
            skipped: true,
            reason:
              "No push subscriptions",
          });
        }

        const targetList =
          formatStatus(
            activity.to_status
          );

        const results = [];

        /*
         * 9. Send push
         */
        for (
          const subscription
          of subscriptions
        ) {
          const badgeCount =
            unseenCountByUser.get(
              subscription.user_id
            ) || 0;

          const payload =
            JSON.stringify({
              title:
                groupTitle,

              body:
                `${actorName}: ${movieTitle} → «${targetList}»`,

              url:
                "/app.html",

              badge_count:
                badgeCount,

              activity_id:
                activity.id,

              group_id:
                activity.group_id,

              movie_id:
                activity.movie_id,

              to_status:
                activity.to_status,
            });

          try {
            const response =
              await webpush
                .sendNotification(
                  {
                    endpoint:
                      subscription.endpoint,

                    keys: {
                      p256dh:
                        subscription.p256dh,

                      auth:
                        subscription.auth,
                    },
                  },
                  payload,
                  {
                    TTL: 300,
                  }
                );

            results.push({
              subscription_id:
                subscription.id,

              user_id:
                subscription.user_id,

              badge_count:
                badgeCount,

              success:
                true,

              statusCode:
                response.statusCode,
            });
          } catch (
            pushError: any
          ) {
            const statusCode =
              pushError?.statusCode ??
              null;

            /*
             * Browser / Apple більше
             * не визнає subscription
             */
            if (
              statusCode === 404 ||
              statusCode === 410
            ) {
              await ctx.supabaseAdmin
                .from(
                  "push_subscriptions"
                )
                .delete()
                .eq(
                  "id",
                  subscription.id
                );
            }

            console.error(
              "Activity push delivery error:",
              pushError
            );

            results.push({
              subscription_id:
                subscription.id,

              user_id:
                subscription.user_id,

              badge_count:
                badgeCount,

              success:
                false,

              statusCode,

              error:
                pushError instanceof Error
                  ? pushError.message
                  : String(
                      pushError
                    ),
            });
          }
        }

        return Response.json({
          success: true,

          activity_id:
            activity.id,

          group:
            groupTitle,

          recipients:
            pushRecipientIds.length,

          subscriptions:
            subscriptions.length,

          results,
        });
      } catch (error) {
        console.error(
          "send-movie-activity-push error:",
          error
        );

        return Response.json(
          {
            success: false,

            error:
              error instanceof Error
                ? error.message
                : String(
                    error
                  ),
          },
          {
            status: 500,
          }
        );
      }
    }
  ),
};
