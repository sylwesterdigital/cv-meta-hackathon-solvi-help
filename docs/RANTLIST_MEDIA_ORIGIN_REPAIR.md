# Restore previously working Rantlist HLS access for SOLVI

## Identify the misplaced header

The browser receives `Access-Control-Allow-Origin: https://mojoworks.xyz` for a media playlist requested by `https://solvi.help`. This response header is generated at `rantlist.me` or its CDN/proxy, **not** at `solvi.help`. Check the current Rantlist vhost and any upstream/CDN response overrides; do not edit the SOLVI `solvi.help` vhost hoping to override it.

On the host that actually serves `rantlist.me`, inspect the effective Nginx configuration using `sudo nginx -T` and locate the `/media/` location and every `Access-Control-Allow-Origin` directive. Back it up. Preserve all existing `/media/` proxy/static, authorization, cache and range settings.

## Nginx allowlist example

Add the `map` at Nginx `http { }` scope (never inside `server` or `location`):

```nginx
map $http_origin $rantlist_media_origin {
    default "";
    "https://solvi.help" $http_origin;
    "https://mojoworks.xyz" $http_origin;
}
```

Within the **existing** `/media/` location, replace the obsolete single-origin `Access-Control-Allow-Origin` rule with:

```nginx
add_header Access-Control-Allow-Origin $rantlist_media_origin always;
add_header Vary Origin always;
add_header Access-Control-Allow-Methods 'GET, HEAD, OPTIONS' always;
```

If `/media/` uses `proxy_pass` and its upstream already sends an incorrect `Access-Control-Allow-Origin`, hide that upstream header using `proxy_hide_header Access-Control-Allow-Origin;` before adding the allowlisted header. Do not create a second conflicting header. If behind a CDN, change or purge the CDN's header override/cache as appropriate; `Vary: Origin` matters. No `Access-Control-Allow-Credentials` is needed for SOLVI's credential-free HLS fetch.

## Verify every playlist and segment

```bash
curl -sS -D - -o /dev/null -H 'Origin: https://solvi.help' 'https://rantlist.me/media/393281aa-ffaa-454b-be4b-a96707840e30/index.m3u8' | grep -iE '^(HTTP/|access-control-allow-origin:|vary:|content-type:)'
curl -sS -D - -o /dev/null -H 'Origin: https://mojoworks.xyz' 'https://rantlist.me/media/393281aa-ffaa-454b-be4b-a96707840e30/index.m3u8' | grep -iE '^(HTTP/|access-control-allow-origin:|vary:|content-type:)'
```

Repeat on a valid `.ts`, `.m4s`, and/or nested `.m3u8` URL referenced by the playlist; check both HTTP 200 and, where used, HTTP 206 partial responses. Do not modify unrelated media hosts or install a general-purpose third-party URL proxy.
