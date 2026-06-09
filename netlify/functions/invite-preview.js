exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;

  const siteUrl =
    process.env.URL || "https://your-site.netlify.app";

  if (!token) {
    return {
      statusCode: 302,
      headers: {
        Location: `${siteUrl}/app.html`,
      },
    };
  }

  const encodedToken = encodeURIComponent(token);

  const appUrl =
    `${siteUrl}/app.html?invite=${encodedToken}`;

  const previewUrl =
    `${siteUrl}/.netlify/functions/invite-preview?token=${encodedToken}`;

  const imageUrl =
    `${siteUrl}/assets/preview/invite-card.png`;

  const html = `
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>Movie Wishlist</title>

  <meta property="og:title" content="Movie Wishlist" />
  <meta property="og:description" content="Запрошення до спільного списку фільмів. Ми просто даємо рекомендаціям дім." />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${previewUrl}" />
  <meta property="og:type" content="website" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Movie Wishlist" />
  <meta name="twitter:description" content="Запрошення до спільного списку фільмів. Ми просто даємо рекомендаціям дім." />
  <meta name="twitter:image" content="${imageUrl}" />

  <script>
    setTimeout(() => {
      window.location.replace("${appUrl}");
    }, 800);
  </script>
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
      "Cache-Control": "no-store",
    },
    body: html,
  };
};
