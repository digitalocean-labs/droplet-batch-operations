$("#delete-form").on("submit", function (e) {
  e.preventDefault();

  const tag = $("#delete-tag").val().trim();
  if (!!!tag) return;

  const query = new URLSearchParams();
  query.set("tag_name", tag);

  const url = `/v2/droplets?${query}`;
  const opts = { method: "DELETE" };

  $(this).find("fieldset").prop("disabled", true);
  const resultDiv = $("#delete-result");

  fetch(url, opts)
    .then((res) => {
      if (res.ok) {
        resultDiv.text("Delete request successful.").addClass("toast-success").removeClass("d-hide");
      } else {
        throw new Error(`${res.status} ${res.statusText} at ${res.url}`);
      }
    })
    .catch((error) => {
      resultDiv.text(error.toString()).addClass("toast-error").removeClass("d-hide");
    });
});
