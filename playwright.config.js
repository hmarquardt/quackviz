// Development-only Playwright configuration. QuackViz production remains a static no-build app.
module.exports = {
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:8080",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 8080",
    url: "http://127.0.0.1:8080",
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
};
