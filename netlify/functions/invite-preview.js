exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;

  if (!token) {
    return {
      statusCode: 302,
      headers: {
        Location: "/app.html",
      },
    };
  }

  const siteUrl = process.env.URL || "https://your-site.netlify.app";
  const appUrl = `${siteUrl}/app.html?invite=${encodeURIComponent(token)}`;
  const imageUrl = `${siteUrl}/assets/preview/invite-card.png`;

  const html = `
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>Запрошення до Movie Wishlist</title>

  <meta property="og:title" content="Запрошення до Movie Wishlist" />
  <meta property="og:description" content="Вас запросили до спільного списку фільмів. Дивіться те, що радять люди, яким ви довіряєте." />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${siteUrl}/.netlify/functions/invite-preview?token=${encodeURIComponent(token)}" />
  <meta property="og:type" content="website" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Запрошення до Movie Wishlist" />
  <meta name="twitter:description" content="Вас запросили до спільного списку фільмів." />
  <meta name="twitter:image" content="${imageUrl}" />

  <meta http-equiv="refresh" content="0; url=${appUrl}" />
</head>

<body>
  <p>
    Переходимо до Movie Wishlist…
    <a href="${appUrl}">Відкрити запрошення</a>
  </p>
</body>
</html>
`;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
    body: html,
  };
};
