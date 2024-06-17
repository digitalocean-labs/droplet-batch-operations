"use strict";

function getJson(url) {
  return fetch(url).then((res) => {
    if (res.ok) {
      return res.json();
    }
    throw new Error(`${res.status} ${res.statusText} at ${res.url}`);
  });
}

function postJson(url, body) {
  const opts = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
  return fetch(url, opts).then((res) => {
    if (res.ok) {
      return res.json();
    }
    throw new Error(`${res.status} ${res.statusText} at ${res.url}`);
  });
}

// Ref: https://docs.digitalocean.com/reference/api/api-reference/#section/Introduction/Links-and-Pagination
function getPages(url, value, accumulator) {
  accumulator = typeof accumulator === "undefined" ? [] : accumulator;
  const publicApi = "https://api.digitalocean.com";
  return getJson(url).then((data) => {
    accumulator = accumulator.concat(data[value]);
    if ("links" in data) {
      if ("pages" in data["links"]) {
        if ("next" in data["links"]["pages"]) {
          let next = data["links"]["pages"]["next"];
          if (next.startsWith(publicApi)) {
            next = next.slice(publicApi.length);
            return getPages(next, value, accumulator);
          }
        }
      }
    }
    return accumulator;
  });
}
