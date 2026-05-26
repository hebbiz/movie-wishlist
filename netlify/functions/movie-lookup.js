exports.handler = async (event) => {
  try {
    const imdbId = event.queryStringParameters.imdbId;

    if (!imdbId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing imdbId parameter",
        }),
      };
    }

    const apiKey = process.env.TMDB_API_KEY;

    const tmdbResponse = await fetch(
      `https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`
    );

    const tmdbData = await tmdbResponse.json();

    const movie = tmdbData.movie_results?.[0];

    if (!movie) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: "Movie not found",
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        title: movie.title,
        year: movie.release_date
          ? movie.release_date.slice(0, 4)
          : null,

        poster_url: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : null,

        overview: movie.overview,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
};