export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // If path starts with /api/, let API functions handle it
  if (url.pathname.startsWith('/api/')) {
    return next();
  }

  // If request has static file extension (e.g. .css, .js, .ico, .png), serve static asset
  if (url.pathname.includes('.')) {
    return next();
  }

  // For SPA route paths (/login, /activation, /success, etc.), serve index.html
  return env.ASSETS.fetch(new URL('/index.html', request.url));
}
