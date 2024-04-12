"use strict";

function fetchJson(url) {
  return fetch(url).then((res) => {
    if (res.ok) {
      return res.json();
    }
    throw new Error(`${res.status} ${res.statusText}\n${res.url}`);
  });
}

// Ref: https://docs.digitalocean.com/reference/api/api-reference/#section/Introduction/Links-and-Pagination
function fetchPages(url, value, accumulator) {
  const publicApi = "https://api.digitalocean.com";
  return fetchJson(url).then((data) => {
    accumulator = accumulator.concat(data[value]);
    if ("links" in data) {
      if ("pages" in data["links"]) {
        if ("next" in data["links"]["pages"]) {
          let next = data["links"]["pages"]["next"];
          if (next.startsWith(publicApi)) {
            next = next.slice(publicApi.length);
            return fetchPages(next, value, accumulator);
          }
        }
      }
    }
    return accumulator;
  });
}

// Ref: https://docs.digitalocean.com/reference/api/api-reference/#operation/regions_list
function fetchRegions() {
  const tmpl = '<option value="{{slug}}">{{name}} ({{slug}})</option>';
  return fetchPages("/v2/regions", "regions", []).then((regions) => {
    const options = regions.toSorted((a, b) => {
      return a["name"].localeCompare(b["name"]);
    }).map((region) => {
      return Mustache.render(tmpl, region);
    });
    options.unshift('<option value="">Select Datacenter ...</option>');
    $("#create-droplets-region").html(options.join("\n"));
    return regions;
  });
}

// Ref: https://docs.digitalocean.com/reference/api/api-reference/#operation/sizes_list
function fetchSizes() {
  const tmpl = '<option value="{{slug}}" class="size {{regions}}">{{name}} ({{slug}}) ${{price}} per month</option>';
  return fetchPages("/v2/sizes", "sizes", []).then((sizes) => {
    const options = sizes.toSorted((a, b) => {
      return a["description"].localeCompare(b["description"]);
    }).map((size) => {
      const data = {
        slug: size["slug"],
        name: size["description"],
        regions: size["regions"].join(" "),
        price: size["price_monthly"],
      };
      return Mustache.render(tmpl, data);
    });
    options.unshift('<option value="">Select Size ...</option>');
    $("#create-droplets-size").html(options.join("\n"));
    return sizes;
  });
}

// Ref: https://docs.digitalocean.com/reference/api/api-reference/#operation/images_list
function fetchImages() {
  const tmpl = '<option value="{{slug}}" class="image {{regions}}">{{distro}} ({{name}})</option>';
  return fetchPages("/v2/images?type=distribution", "images", []).then((images) => {
    const options = images.toSorted((a, b) => {
      return a["distribution"].localeCompare(b["distribution"]);
    }).map((image) => {
      const data = {
        slug: image["slug"],
        name: image["name"],
        distro: image["distribution"],
        regions: image["regions"].join(" "),
      };
      return Mustache.render(tmpl, data);
    });
    options.unshift('<option value="">Select Image ...</option>');
    $("#create-droplets-image").html(options.join("\n"));
    return images;
  });
}

// Ref: https://docs.digitalocean.com/reference/api/api-reference/#operation/sshKeys_list
function fetchSshKeys() {
  const tmpl = '<option value="{{fingerprint}}">{{name}}</option>';
  return fetchPages("/v2/account/keys", "ssh_keys", []).then((keys) => {
    const options = keys.toSorted((a, b) => {
      return a["name"].localeCompare(b["name"]);
    }).map((key) => {
      return Mustache.render(tmpl, key);
    });
    $("#create-droplets-ssh").html(options.join("\n"));
    return keys;
  });
}

function registerRegionChangeListener() {
  $("#create-droplets-region").on("change", function () {
    const region = $(this).val();
    $("#create-droplets-size .size").addClass("d-hide").prop("disabled", true);
    $(`#create-droplets-size .${region}`).removeClass("d-hide").prop("disabled", false);
    $("#create-droplets-image .image").addClass("d-hide").prop("disabled", true);
    $(`#create-droplets-image .${region}`).removeClass("d-hide").prop("disabled", false);
  });
}

function registerFormSubmitListener() {
  $("#create-droplets-form fieldset").prop("disabled", false);
  $("#create-droplets-form").on("submit", function (event) {
    event.preventDefault();

    const self = $(this);
    self.find(".form-input-hint").addClass("d-hide");
    self.find(".form-group").removeClass("has-error");

    const form = parseCreateForm();
    if (form.errors.length > 0) {
      for (const element of form.errors) {
        $(element).closest(".form-group").addClass("has-error");
        $(element).siblings(".form-input-hint").removeClass("d-hide");
      }
      return false;
    }

    self.find("fieldset").prop("disabled", true);
    $("#create-droplets-btn").closest(".form-group").hide();

    const requests = createRequests(form);
    renderCreatedDroplets(form, requests);
    createDroplets(requests);
  });
}

function parseCreateForm() {
  const errors = [];
  const region = $("#create-droplets-region").val();
  if (!!!region) {
    errors.push("#create-droplets-region");
  }
  const size = $("#create-droplets-size").val();
  if (!!!size) {
    errors.push("#create-droplets-size");
  }
  const image = $("#create-droplets-image").val();
  if (!!!image) {
    errors.push("#create-droplets-image");
  }
  const prefix = $("#create-droplets-name").val().trim();
  if (!!!prefix) {
    errors.push("#create-droplets-name");
  }
  const count = parseInt($("#create-droplets-count").val().trim());
  if (isNaN(count) || count < 1) {
    errors.push("#create-droplets-count");
  }
  const ssh = $("#create-droplets-ssh").val();
  if (ssh.length === 0) {
    errors.push("#create-droplets-ssh");
  }
  let tags = []
  const tagsTxt = $("#create-droplets-tags").val().trim();
  if (!!tagsTxt) {
    tags = tagsTxt.split(",").map((txt) => txt.trim()).filter((txt) => !!txt)
  }
  const userdata = $("#create-droplets-userdata").val().trim();
  const monitoring = $("#create-droplets-monitoring").is(":checked");
  const backups = $("#create-droplets-backups").is(":checked");
  const ipv6 = $("#create-droplets-ipv6").is(":checked");
  return {
    region: region,
    size: size,
    image: image,
    prefix: prefix,
    count: count,
    ssh: ssh,
    tags: tags,
    userdata: userdata,
    monitoring: monitoring,
    backups: backups,
    ipv6: ipv6,
    errors: errors,
  }
}

// Ref: https://docs.digitalocean.com/reference/api/api-reference/#operation/droplets_create
function createRequests(form) {
  const requests = [];
  for (let i = 1; i <= form.count; i++) {
    const droplet = {
      name: `${form.prefix}${i}`,
      region: form.region,
      size: form.size,
      image: form.image,
      ssh_keys: form.ssh,
    };
    if (form.monitoring) {
      droplet["monitoring"] = true;
    }
    if (form.backups) {
      droplet["backups"] = true;
    }
    if (form.ipv6) {
      droplet["ipv6"] = true;
    }
    if (form.tags.length > 0) {
      droplet["tags"] = form.tags;
    }
    if (!!form.userdata) {
      droplet["user_data"] = form.userdata;
    }
    requests.push({ row: i, droplet: droplet });
  }
  return requests;
}

function renderCreatedDroplets(form, requests) {
  const tags = form.tags.map((tag) => {
    const params = new URLSearchParams();
    params.set("tag", tag);
    params.set("refresh", "1");
    return {
      name: tag,
      href: `/metrics.html?${params}`,
    };
  });
  const data = {
    tags: tags,
    has_tags: tags.length > 0,
    requests: requests,
  };
  const tmpl = $("#created-droplets-template").text();
  const content = Mustache.render(tmpl, data);
  $("#created-droplets").html(content);
}

function createDroplets(requests) {
  window.setTimeout(function () {
    const batchSize = Math.min(requests.length, 10);
    for (let i = 0; i < batchSize; i++) {
      const req = requests.shift();
      createDroplet(req, requests);
    }
  });
}

function createNextDroplet(requests) {
  if (requests.length > 0) {
    const req = requests.shift();
    window.setTimeout(function () {
      createDroplet(req, requests);
    });
  }
}

// Ref: https://docs.digitalocean.com/reference/api/api-reference/#operation/droplets_create
function createDroplet(req, requests) {
  const dropletRow = $(`#droplet-${req.row}`);
  const dropletID = dropletRow.find(".droplet-id");
  const dropletIPv4 = dropletRow.find(".droplet-ipv4");
  const dropletIPv6 = dropletRow.find(".droplet-ipv6");
  const dropletStatus = dropletRow.find(".droplet-status");
  const opts = {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req.droplet),
  };
  fetch("/v2/droplets", opts).then((res) => {
    if (res.ok) {
      return res.json();
    }
    throw new Error(
      `${res.status} ${res.statusText}\n${res.url}`
    );
  }).then((data) => {
    dropletID.text(data["droplet"]["id"]);
    dropletStatus.text(data["droplet"]["status"]);
    waitForDroplet(req.row, data["droplet"]["id"], requests);
  }).catch((error) => {
    dropletID.text("N/A");
    dropletIPv4.text("N/A");
    dropletIPv6.text("N/A");
    dropletStatus.text(error.toString());
    console.error(`droplet-${req.row}`, error);
    createNextDroplet(requests);
  });
}

function waitForDroplet(rowID, dropletID, requests) {
  window.setTimeout(function () {
    checkDroplet(rowID, dropletID, requests);
  }, 10000);
}

// Ref: https://docs.digitalocean.com/reference/api/api-reference/#operation/droplets_get
function checkDroplet(rowID, dropletID, requests) {
  const dropletRow = $(`#droplet-${rowID}`);
  const dropletIPv4 = dropletRow.find(".droplet-ipv4");
  const dropletIPv6 = dropletRow.find(".droplet-ipv6");
  const dropletStatus = dropletRow.find(".droplet-status");
  fetchJson(`/v2/droplets/${dropletID}`).then((data) => {
    const status = data["droplet"]["status"];
    switch (status) {
      case "new":
        waitForDroplet(rowID, dropletID, requests);
        return;
      case "active":
        dropletIPv4.text("N/A");
        dropletIPv6.text("N/A");
        dropletStatus.text(status);
        if ("v4" in data["droplet"]["networks"]) {
          for (const network of data["droplet"]["networks"]["v4"]) {
            if (network["type"] === "public") {
              dropletIPv4.text(network["ip_address"]);
            }
          }
        }
        if ("v6" in data["droplet"]["networks"]) {
          for (const network of data["droplet"]["networks"]["v6"]) {
            if (network["type"] === "public") {
              dropletIPv6.text(network["ip_address"]);
            }
          }
        }
        createNextDroplet(requests);
        return;
      default:
        dropletIPv4.text("N/A");
        dropletIPv6.text("N/A");
        dropletStatus.text(status);
        createNextDroplet(requests);
        return;
    }
  }).catch((error) => {
    dropletIPv4.text("N/A");
    dropletIPv6.text("N/A");
    dropletStatus.text(error.toString());
    console.error(`droplet-${rowID}`, error);
    createNextDroplet(requests);
  });
}

Promise.all([
  fetchRegions(),
  fetchSizes(),
  fetchImages(),
  fetchSshKeys(),
]).then((_) => {
  registerRegionChangeListener();
  registerFormSubmitListener();
}).catch((error) => {
  console.error(error);
  $("#create-droplets").text(error.toString());
});