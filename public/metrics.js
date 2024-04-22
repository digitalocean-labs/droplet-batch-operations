"use strict";

function renderChart(elementID, title, yAxis, series) {
  Highcharts.chart(elementID, {
    chart: {
      type: "line",
    },
    title: {
      text: title,
    },
    yAxis: {
      title: {
        text: yAxis,
      },
    },
    xAxis: {
      title: {
        text: "Time (UTC)",
      },
      type: "datetime",
      labels: {
        format: "{value:%Y-%m-%d<br>%H:%M}",
      },
    },
    legend: {
      layout: "vertical",
      align: "right",
      verticalAlign: "middle",
    },
    series: series,
  });
}

function reportError(elementID, error) {
  console.error(elementID, error);
  document.getElementById(elementID).innerText = error.toString();
}

function searchDroplets(tag) {
  const query = new URLSearchParams();
  query.set("tag_name", tag);
  const url = `/v2/droplets?${query}`;
  return getPages(url, "droplets", []);
}

function newSearchUnixTime(hours) {
  let millis = Date.now();
  if (hours > 0) {
    millis = millis - hours * 60 * 60 * 1000;
  }
  return (millis / 1000).toFixed(0);
}

const searchEnd = newSearchUnixTime(0); // now
const searchStart = newSearchUnixTime(1); // 1 hour ago

function searchMetrics(searchType, dropletID) {
  let searchUrl = "";
  const query = new URLSearchParams();
  switch (searchType) {
    case "bandwidth-inbound":
      query.set("host_id", dropletID.toString());
      query.set("interface", "public");
      query.set("direction", "inbound");
      query.set("start", searchStart);
      query.set("end", searchEnd);
      searchUrl = "/v2/monitoring/metrics/droplet/bandwidth";
      break;
    case "bandwidth-outbound":
      query.set("host_id", dropletID.toString());
      query.set("interface", "public");
      query.set("direction", "outbound");
      query.set("start", searchStart);
      query.set("end", searchEnd);
      searchUrl = "/v2/monitoring/metrics/droplet/bandwidth";
      break;
    case "cpu-usage":
      query.set("host_id", dropletID.toString());
      query.set("start", searchStart);
      query.set("end", searchEnd);
      searchUrl = "/v2/monitoring/metrics/droplet/cpu";
      break;
    case "memory-free":
      query.set("host_id", dropletID.toString());
      query.set("start", searchStart);
      query.set("end", searchEnd);
      searchUrl = "/v2/monitoring/metrics/droplet/memory_free";
      break;
    case "memory-total":
      query.set("host_id", dropletID.toString());
      query.set("start", searchStart);
      query.set("end", searchEnd);
      searchUrl = "/v2/monitoring/metrics/droplet/memory_total";
      break;
    default:
      return Promise.reject(new Error(`Unknown search type: "${searchType}"`));
  }
  return getJson(`${searchUrl}?${query}`);
}

function noResults(data) {
  if ("data" in data) {
    if ("result" in data["data"]) {
      return data["data"]["result"].length === 0;
    }
  }
  return true;
}

function bandwidthSeries(dropletName, data) {
  if (noResults(data)) {
    return {
      name: dropletName,
      data: [],
    };
  }
  const values = data["data"]["result"][0]["values"].map((value) => {
    return [value[0] * 1000, parseFloat(value[1])];
  });
  return {
    name: dropletName,
    data: values,
  };
}

function inboundMetrics(droplets) {
  const dropletMetrics = droplets.map((droplet) => {
    return searchMetrics("bandwidth-inbound", droplet["id"]).then((data) => {
      return bandwidthSeries(droplet["name"], data);
    });
  });
  Promise.all(dropletMetrics)
    .then((series) => {
      renderChart("bandwidth-inbound", "Droplet Bandwidth (public, inbound)", "Bandwidth (Mbps)", series);
    })
    .catch((error) => {
      reportError("bandwidth-inbound", error);
    });
}

function outboundMetrics(droplets) {
  const dropletMetrics = droplets.map((droplet) => {
    return searchMetrics("bandwidth-outbound", droplet["id"]).then((data) => {
      return bandwidthSeries(droplet["name"], data);
    });
  });
  Promise.all(dropletMetrics)
    .then((series) => {
      renderChart("bandwidth-outbound", "Droplet Bandwidth (public, outbound)", "Bandwidth (Mbps)", series);
    })
    .catch((error) => {
      reportError("bandwidth-outbound", error);
    });
}

function usedCpuSeries(dropletName, data) {
  if (noResults(data)) {
    return {
      name: dropletName,
      data: [],
    };
  }
  const ticks = new Map();
  data["data"]["result"].forEach((res) => {
    const mode = res["metric"]["mode"];
    res["values"].forEach((value) => {
      const tick = value[0] * 1000;
      const metric = parseFloat(value[1]);
      if (ticks.has(tick)) {
        const metrics = ticks.get(tick);
        metrics.set(mode, metric);
      } else {
        const metrics = new Map();
        metrics.set(mode, metric);
        ticks.set(tick, metrics);
      }
    });
  });
  const series = [];
  for (const tick of ticks.keys()) {
    const metrics = ticks.get(tick);
    const idleCpu = metrics.get("idle");
    let totalCpu = 0;
    for (const metric of metrics.values()) {
      totalCpu = totalCpu + metric;
    }
    const usedCpu = ((totalCpu - idleCpu) / totalCpu) * 100.0;
    series.push([tick, usedCpu]);
  }
  return {
    name: dropletName,
    data: series,
  };
}

function cpuUsageMetrics(droplets) {
  const dropletMetrics = droplets.map((droplet) => {
    return searchMetrics("cpu-usage", droplet["id"]).then((data) => {
      return usedCpuSeries(droplet["name"], data);
    });
  });
  Promise.all(dropletMetrics)
    .then((series) => {
      renderChart("cpu-usage", "CPU Usage", "Used %", series);
    })
    .catch((error) => {
      reportError("cpu-usage", error);
    });
}

function usedMemorySeries(dropletName, freeData, totalData) {
  if (noResults(freeData) || noResults(totalData)) {
    return {
      name: dropletName,
      data: [],
    };
  }
  const freeValues = freeData["data"]["result"][0]["values"];
  const totalValues = totalData["data"]["result"][0]["values"];
  const series = [];
  for (let i = 0; i < freeValues.length; i++) {
    const tick = freeValues[i][0] * 1000;
    const freeMem = parseFloat(freeValues[i][1]);
    const totalMem = parseFloat(totalValues[i][1]);
    const usedMem = ((totalMem - freeMem) / totalMem) * 100.0;
    series.push([tick, usedMem]);
  }
  return {
    name: dropletName,
    data: series,
  };
}

function memoryUsageMetrics(droplets) {
  const dropletMetrics = droplets.map((droplet) => {
    const freeReq = searchMetrics("memory-free", droplet["id"]);
    const totalReq = searchMetrics("memory-total", droplet["id"]);
    return Promise.all([freeReq, totalReq]).then((data) => {
      return usedMemorySeries(droplet["name"], data[0], data[1]);
    });
  });
  Promise.all(dropletMetrics)
    .then((series) => {
      renderChart("memory-usage", "Memory Usage", "Used %", series);
    })
    .catch((error) => {
      reportError("memory-usage", error);
    });
}

function unhideElement(elementID) {
  document.getElementById(elementID).classList.remove("hidden");
}

let tagName = null;
let refreshMinutes = 0;
const pageQuery = window.location.search;
if (!!pageQuery) {
  const pageParams = new URLSearchParams(pageQuery);
  tagName = pageParams.get("tag");
  const refreshTxt = pageParams.get("refresh");
  refreshMinutes = !!refreshTxt ? parseInt(refreshTxt) : 0;
}
if (!!tagName) {
  unhideElement("container");
  searchDroplets(tagName)
    .then((droplets) => {
      inboundMetrics(droplets);
      outboundMetrics(droplets);
      cpuUsageMetrics(droplets);
      memoryUsageMetrics(droplets);
    })
    .catch((error) => {
      reportError("container", error);
    });
  if (!isNaN(refreshMinutes) && refreshMinutes > 0) {
    const reloadMillis = refreshMinutes * 60 * 1000;
    window.setTimeout(function () {
      window.location.reload();
    }, reloadMillis);
  }
} else {
  unhideElement("setup");
  document.getElementById("setup-tag").focus();
}
