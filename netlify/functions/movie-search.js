exports.handler = async function (event) {
  const query = event.queryStringParameters.query;

  if (!query) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Query is required" }),
    };
  }

  const apiKey = process.env.TMDB_API_KEY;

  const url =
    "https://api.themoviedb.org/3/search/movie" +
    `?api_key=${apiKey}` +
    `&query=${encodeURIComponent(query)}` +
    "&language=uk-UA";

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.status_message || "TMDb error" }),
      };
    }

    const results = (data.results || []).slice(0, 8).map((movie) => ({
      title: movie.title,
      year: movie.release_date
        ? Number(movie.release_date.slice(0, 4))
        : null,
      tmdb_id: movie.id,
      imdb_id: null,
      poster_url: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null,
      overview: movie.overview || null,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ results }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
