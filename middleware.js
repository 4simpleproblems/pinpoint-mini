export default function middleware(request) {
  const referer = request.headers.get('referer') || '';
  if (referer.includes('securly.com') || referer.includes('deviceconsole') || referer.includes('securly')) {
    return Response.redirect('https://classroom.google.com', 307);
  }
}

export const config = {
  matcher: '/:path*',
};
