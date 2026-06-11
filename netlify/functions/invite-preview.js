import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  const token = event.queryStringParameters?.token;

  if (!token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing token" }),
    };
  }

  const { data, error } = await supabase
    .from("invitations")
    .select(`
      token,
      group_id,
      groups (
        name,
        type
      )
    `)
    .eq("token", token)
    .single();

  if (error || !data) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Invite not found" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      groupName: data.groups?.name,
      groupType: data.groups?.type,
    }),
  };
}
