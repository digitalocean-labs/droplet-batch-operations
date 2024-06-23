$("#delete-form").on("submit", function (e) {
  e.preventDefault();

  const tag = $("#delete-tag").val().trim();
  if (!!!tag) return;

  const query = new URLSearchParams();
  query.set("tag_name", tag);

  const url = `/v2/droplets?${query}`;
  const opts = { method: "DELETE" };

  const fieldset = $(this).find("fieldset");
  fieldset.prop("disabled", true);

  const resultDiv = $("#delete-result");
  fetch(url, opts)
    .then((res) => {
      if (res.ok) {
        resultDiv.text("Delete request successful.").addClass("alert-success").removeClass("d-none");
        fieldset.prop("disabled", false);
      } else {
        throw new Error(`${res.status} ${res.statusText} at ${res.url}`);
      }
    })
    .catch((error) => {
      resultDiv.text(error.toString()).addClass("alert-danger").removeClass("d-none");
      fieldset.prop("disabled", false);
    });
});
