(function() {
  'use strict';
  
  if (self.GM.fetch) {
    return
  }

  function parseHeaders(responseHeaders) {
    const headers = new Headers();
    for (const line of responseHeaders.trim().split(/\s*(?:\n|$)\s*/)) {
      headers.append(...line.split(/\s*:\s*(.*)/, 2));
    }

    return headers;
  }

  self.GM.fetch = async function(input, init) {
    const request = new Request(input, init);

    const xhr_details = {
      method: request.method,
      url: request.url,
      synchronous: false,
      headers: Object.fromEntries(request.headers.entries()),
      responseType: 'arraybuffer',
      data: await request.arrayBuffer(),
    };

    if (init != null && init.onprogress !== undefined) {
      xhr_details.onprogress = init.onprogress;
    }

    const resp = await GM.xmlHttpRequest(xhr_details).catch((err) => {
      throw new TypeError('Network request failed', { cause: err });
    }).then((r) => {
      if (r.status < 100 || r.status > 599) {
        throw new TypeError('Network request failed');
      }
      return r;
    });

    const res = new Response(resp.response, {
      status: resp.status,
      statusText: resp.statusText,
      headers: parseHeaders(resp.responseHeaders),
    });

    return new Proxy(res, {
      get(target, prop) {
        switch (prop) {
          case 'type':
            return 'cors';
          case 'url':
            return resp.finalUrl;
          case 'redirected':
            return resp.finalUrl != request.url;
          default:
            return Reflect.get(target, prop);
        }
      },
    });
  }
})();
