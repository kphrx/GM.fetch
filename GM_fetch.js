(function() {
  'use strict';

  if (typeof self.GM?.xmlHttpRequest !== 'function' && typeof self.GM_xmlhttpRequest !== 'function') {
    return;
  }

  if (typeof self.GM === 'undefined') {
    self.GM = {};
  }
  const GM = self.GM;

  if (GM.fetch) {
    return
  }

  if (typeof GM.xmlHttpRequest !== 'function') {
    GM.xmlHttpRequest = async function(details) {
      return new Promise((resolve, reject) => {
        const { onload, onerror } = details;
        self.GM_xmlhttpRequest({
          ...details,
          onload: onload ? v => { resolve(v); onload(v); } : resolve,
          onerror: onerror ? v => { reject(v); onerror(v); } : reject
        });
      });
    }
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
    const signal = request.signal;

    signal.throwIfAborted();

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

    signal.throwIfAborted();

    const { promise: req, resolve, reject } = Promise.withResolvers();
    xhr_details.onabort = () => {
      reject(signal.aborted && signal.reason || new DOMException('The operation was aborted.', 'AbortError'));
    }
    const requestControl = GM.xmlHttpRequest(xhr_details);
    request.signal.addEventListener('abort', () => {
      requestControl.abort();
    });
    resolve(requestControl.catch((err) => {
      throw new TypeError('Network request failed', { cause: err });
    }).then(r => {
      if (r.status < 100 || r.status > 599) {
        throw new TypeError('Network request failed');
      }
      return r;
    }));

    const resp = await req;

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
            return resp.finalUrl !== request.url;
          default:
            return Reflect.get(target, prop);
        }
      },
    });
  }
})();
