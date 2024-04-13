"use strict";

// Ref: https://docs.digitalocean.com/reference/api/api-reference/#operation/regions_list
function fetchRegions() {
  const tmpl = '<option value="{{slug}}">{{name}} ({{slug}})</option>';
  return getPages("/v2/regions", "regions", []).then((regions) => {
    const options = regions
      .toSorted((a, b) => {
        return a["name"].localeCompare(b["name"]);
      })
      .map((region) => {
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
  return getPages("/v2/sizes", "sizes", []).then((sizes) => {
    const options = sizes
      .toSorted((a, b) => {
        return a["description"].localeCompare(b["description"]);
      })
      .map((size) => {
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
  return getPages("/v2/images?type=distribution", "images", []).then((images) => {
    const options = images
      .toSorted((a, b) => {
        return a["distribution"].localeCompare(b["distribution"]);
      })
      .map((image) => {
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
  return getPages("/v2/account/keys", "ssh_keys", []).then((keys) => {
    const options = keys
      .toSorted((a, b) => {
        return a["name"].localeCompare(b["name"]);
      })
      .map((key) => {
        return Mustache.render(tmpl, key);
      });
    $("#create-droplets-ssh").html(options.join("\n"));
    return keys;
  });
}

function registerRegionChangeListener() {
  $("#create-droplets-region").on("change", function () {
    const region = $(this).val();
    $("#create-droplets-size").val("");
    $("#create-droplets-size .size").addClass("d-hide").prop("disabled", true);
    $(`#create-droplets-size .${region}`).removeClass("d-hide").prop("disabled", false);
    $("#create-droplets-image").val("");
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
  let tags = [];
  const tagsTxt = $("#create-droplets-tags").val().trim();
  if (!!tagsTxt) {
    tags = tagsTxt
      .split(",")
      .map((txt) => txt.trim())
      .filter((txt) => !!txt);
  }
  if (tags.length === 0) {
    errors.push("#create-droplets-tags");
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
  };
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
      tags: form.tags,
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
    requests: requests,
  };
  const tmpl = $("#created-droplets-template").text();
  const content = Mustache.render(tmpl, data);
  $("#created-droplets").html(content);
}

function createDroplets(requests) {
  window.setTimeout(function () {
    const batch = [];
    const batchSize = Math.min(requests.length, 10);
    for (let i = 0; i < batchSize; i++) {
      batch.push(requests.shift());
    }
    for (const req of batch) {
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
  postJson("/v2/droplets", req.droplet)
    .then((data) => {
      dropletID.text(data["droplet"]["id"]);
      dropletStatus.text(data["droplet"]["status"]);
      waitForDroplet(req.row, data["droplet"]["id"], requests);
    })
    .catch((error) => {
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
  }, 15000);
}

// Ref: https://docs.digitalocean.com/reference/api/api-reference/#operation/droplets_get
function checkDroplet(rowID, dropletID, requests) {
  const dropletRow = $(`#droplet-${rowID}`);
  const dropletIPv4 = dropletRow.find(".droplet-ipv4");
  const dropletIPv6 = dropletRow.find(".droplet-ipv6");
  const dropletStatus = dropletRow.find(".droplet-status");
  getJson(`/v2/droplets/${dropletID}`)
    .then((data) => {
      const status = data["droplet"]["status"];
      switch (status) {
        case "new":
          waitForDroplet(rowID, dropletID, requests);
          return;
        case "active":
          dropletIPv4.text(getPublicAddress(data, "v4"));
          dropletIPv6.text(getPublicAddress(data, "v6"));
          dropletStatus.text(status);
          createNextDroplet(requests);
          return;
        default:
          dropletIPv4.text("N/A");
          dropletIPv6.text("N/A");
          dropletStatus.text(status);
          createNextDroplet(requests);
          return;
      }
    })
    .catch((error) => {
      dropletIPv4.text("N/A");
      dropletIPv6.text("N/A");
      dropletStatus.text(error.toString());
      console.error(`droplet-${rowID}`, error);
      createNextDroplet(requests);
    });
}

function getPublicAddress(data, ipFamily) {
  if (ipFamily in data["droplet"]["networks"]) {
    for (const network of data["droplet"]["networks"][ipFamily]) {
      if (network["type"] === "public") {
        return network["ip_address"];
      }
    }
  }
  return "N/A";
}

Promise.all([fetchRegions(), fetchSizes(), fetchImages(), fetchSshKeys()])
  .then((_) => {
    registerRegionChangeListener();
    registerFormSubmitListener();
  })
  .catch((error) => {
    console.error(error);
    $("#create-droplets").text(error.toString());
  });
