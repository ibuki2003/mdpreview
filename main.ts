import { KATEX_CSS, render } from "./render.ts";
import { contentType } from "https://deno.land/x/media_types@v2.11.0/mod.ts";
import { extname, join } from "https://deno.land/std@0.115.1/path/mod.ts";
import { readableStreamFromReader } from "https://deno.land/std@0.177.1/streams/mod.ts";

const PORT = 8080;

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>md6</title>
  <style>${KATEX_CSS}</style>
  <style>
  html {
    margin: 0;
    padding: 0;
    width: 100% !important
  }
  body {
    margin: 1em;
    padding: 0;
  }
  .katex-display {
    margin: 0em !important;
  }
  .katex-display>.katex {
    text-align: left;
  }
  img {
    max-width: 100%;
    height: auto;
  }
  </style>
</head>
<body>
<div id="app"></div>
<script>
const e = document.getElementById('app');
async function main() {
  while (true) {
    try {
      const res = await (fetch(\`/api?path=\${location.pathname}\`).then(res => res.json()));
      e.innerHTML = res.data;
      await fetch(\`/watch?path=\${location.pathname}\`);
    } catch (e) {
      console.error(e);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
main()
</script>
</body>
</html>
`;

async function waitWatch(filename: string) {
  const watcher = Deno.watchFs(filename);
  for await (const _ of watcher) {
    break;
  }
}

function timeoutPromise(p: Promise<void>, ms: number) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve();
    }, ms);
    p.then(
      (val) => {
        clearTimeout(timeout);
        resolve(val);
      },
      (err) => {
        clearTimeout(timeout);
        reject(err);
      }
    );
  });
}

async function main(basepath: string) {
  const server = Deno.listen({ port: PORT });
  console.log(
    `HTTP webserver running. Access it at: http://localhost:${PORT}/`
  );

  for await (const conn of server) {
    serveHttp(conn);
  }

  async function serveHttp(conn: Deno.Conn) {
    const httpConn = Deno.serveHttp(conn);
    for await (const requestEvent of httpConn) {
      const url = new URL(requestEvent.request.url);
      console.log(url.href);
      const path = url.searchParams.get("path");
      const filename = path ? join(basepath, path) : null;

      if (url.pathname === "/api") {
        if (!filename) {
          requestEvent.respondWith( new Response(null, { status: 400, }));
          continue;
        }
        const body = JSON.stringify({
          data: render(Deno.readTextFileSync(filename), {
            allowMath: true,
            marked_options: {
              breaks: true,
              mangle: false,
            },
          }),
        });
        await requestEvent.respondWith(
          new Response(body, {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          })
        );
        continue;
      } else if (url.pathname == "/watch") {
        if (!filename) {
          requestEvent.respondWith( new Response(null, { status: 400, }));
          continue;
        }

        await timeoutPromise(waitWatch(filename), 60000);
        try {
          await requestEvent.respondWith(new Response(null, { status: 204 }));
        } catch (e) {
          console.error(e);
        }
        continue;
      } else if (url.pathname === "/") {
        requestEvent.respondWith( new Response(null, { status: 204, }));
      } else {
        const filepath = `${basepath}${url.pathname}`;
        if (filepath.endsWith(".md")) {
          requestEvent.respondWith(
            new Response(HTML_TEMPLATE, {
              status: 200,
              headers: {
                "content-type": "text/html",
              },
            })
          );
        } else {
          const mime = contentType(extname(filepath)) || "text/plain";
          console.log(filepath);
          try {
            const fileStream = await Deno.open(filepath);
            await requestEvent.respondWith(
              new Response(readableStreamFromReader(fileStream), {
                status: 200,
                headers: {
                  "content-type": mime,
                },
              })
            );
          } catch (e) {
            console.error(e);
            requestEvent.respondWith(
              new Response(null, {
                status: 404,
              })
            );
          }
        }
      }
    }
  }
}

main(Deno.args[0]);
