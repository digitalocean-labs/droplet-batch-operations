"use strict";

// Ref: https://docs.digitalocean.com/reference/api/api-reference/#operation/regions_list
function fetchRegions() {
  const tmpl = '<option value="{{slug}}">{{name}} ({{slug}})</option>';
  return getPages("/v2/regions", "regions").then((regions) => {
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
  return getPages("/v2/sizes?per_page=200", "sizes").then((sizes) => {
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
  return getPages("/v2/images?type=distribution", "images").then((images) => {
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
  return getPages("/v2/account/keys", "ssh_keys").then((keys) => {
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
    $("#create-droplets-size .size").addClass("d-none").prop("disabled", true);
    $(`#create-droplets-size .${region}`).removeClass("d-none").prop("disabled", false);
    $("#create-droplets-size").val("").trigger("chosen:updated");
    $("#create-droplets-image .image").addClass("d-none").prop("disabled", true);
    $(`#create-droplets-image .${region}`).removeClass("d-none").prop("disabled", false);
    $("#create-droplets-image").val("").trigger("chosen:updated");
  });
}

function registerFormSubmitListener() {
  $("#create-droplets-form fieldset").prop("disabled", false);
  $("select.chosen-select").chosen({
    disable_search_threshold: 10,
    search_contains: true,
    width: "100%",
  });
  $("label.initial-focus").trigger("click");
  $("#create-droplets-form").on("submit", function (event) {
    event.preventDefault();

    const self = $(this);
    self.find(".is-invalid").removeClass("is-invalid");

    const form = parseCreateForm();
    if (form.errors.length > 0) {
      for (const element of form.errors) {
        $(element).addClass("is-invalid");
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
  postJson("/v2/droplets", req.droplet)
    .then((data) => {
      const dropletID = data["droplet"]["id"];
      const status = data["droplet"]["status"];
      updateDropletRow(req.row, { id: dropletID, status: status });
      waitForDroplet(req.row, dropletID, requests);
    })
    .catch((error) => {
      updateDropletRow(req.row, { id: "N/A", ipv4: "N/A", ipv6: "N/A", status: error.toString() });
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
  getJson(`/v2/droplets/${dropletID}`)
    .then((data) => {
      const status = data["droplet"]["status"];
      switch (status) {
        case "new":
          waitForDroplet(rowID, dropletID, requests);
          return;
        case "active":
          const ipv4 = getPublicAddress(data, "v4");
          const ipv6 = getPublicAddress(data, "v6");
          updateDropletRow(rowID, { ipv4: ipv4, ipv6: ipv6, status: status });
          createNextDroplet(requests);
          return;
        default:
          updateDropletRow(rowID, { ipv4: "N/A", ipv6: "N/A", status: status });
          createNextDroplet(requests);
          return;
      }
    })
    .catch((error) => {
      updateDropletRow(rowID, { ipv4: "N/A", ipv6: "N/A", status: error.toString() });
      console.error(`droplet-${rowID}`, error);
      createNextDroplet(requests);
    });
}

function updateDropletRow(rowID, data) {
  const row = $(`#droplet-${rowID}`);
  if ("id" in data) {
    row.find(".droplet-id").text(data["id"]);
  }
  if ("ipv4" in data) {
    row.find(".droplet-ipv4").text(data["ipv4"]);
  }
  if ("ipv6" in data) {
    row.find(".droplet-ipv6").text(data["ipv6"]);
  }
  if ("status" in data) {
    row.find(".droplet-status").text(data["status"]);
  }
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
