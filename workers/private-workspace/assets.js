/** Private application code has no documents embedded in it. All document,
 * directory, map and image data is served separately behind API authentication. */
export async function privateWorkspaceAssets(request,env){
 const url=new URL(request.url)
 if(url.pathname==='/workspace')return Response.redirect(url.origin+'/workspace/'+url.search,308)
 if(!url.pathname.startsWith('/workspace/'))return null
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}})
 if(!env.ASSETS?.fetch)return new Response('Private workspace assets are not configured',{status:503,headers:{'Cache-Control':'no-store'}})
 const response=await env.ASSETS.fetch(request),headers=new Headers(response.headers)
 headers.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'")
 headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY')
 headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()')
 headers.set('X-Robots-Tag','noindex, nofollow, noarchive')
 headers.set('Cache-Control',url.pathname.includes('/assets/')?'public, max-age=31536000, immutable':'private, no-store')
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers})
}
