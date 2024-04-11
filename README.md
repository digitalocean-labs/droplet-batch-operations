# Droplet Batch Operations

> [!WARNING]
> We do NOT recommend running this configuration over the internet, or on unsecured networks, without any access controls. Your infrastructure is confidential and should not be easily accessible by unauthorised individuals. Please configure [https](https://caddyserver.com/docs/quick-starts/https) and at a minimum [basic user authentication](https://caddyserver.com/docs/caddyfile/directives/basicauth).

Use DigitalOcean's [Public API](https://docs.digitalocean.com/reference/api/api-reference/) to automate operations that are limited by the [Cloud UI](https://cloud.digitalocean.com).

Start the local [Caddy](https://caddyserver.com/docs/) http server:

```bash
export DIGITALOCEAN_TOKEN='[REDACTED]'
./serve.sh
```

Navigate to http://localhost:8080

Currently implemented batch operations:
* Create more than 10 droplets at a time.

## Example

![Screenshot](example.png)
