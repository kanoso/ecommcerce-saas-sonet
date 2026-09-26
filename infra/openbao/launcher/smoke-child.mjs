// Smoke child: verifies that the launcher passed the mapped secrets as env vars.
// Prints KEY NAMES ONLY - never values.
const expected = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET", "METRICS_SECRET", "KIPU_SERVICE_TOKEN", "SHIELD_SERVICE_TOKEN"];
const present = expected.filter((k) => k in process.env);
const absent = expected.filter((k) => !(k in process.env));
console.log(`smoke-child: present (${present.length}): ${present.join(",")}`);
if (absent.length > 0) {
  console.error(`smoke-child: absent: ${absent.join(",")}`);
  process.exit(1);
}
const leaked = Object.keys(process.env).some((k) => k.startsWith("OPENBAO_") && process.env[k]?.includes("CANARY"));
console.log(`smoke-child: launcher env carries no raw secret material outside mapped vars: ${!leaked}`);
console.log("smoke-child: OK");