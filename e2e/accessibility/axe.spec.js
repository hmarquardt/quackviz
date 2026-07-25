const AxeBuilder = require("@axe-core/playwright").default;
const { test, expect, gotoApp, selectWorkspaceTab } = require("../fixtures");

for (const screen of ["data", "sql", "visualize", "dashboard", "report", "ai", "debug"]) {
  test(`${screen} screen has no serious or critical axe violations`, async ({ page }) => {
    await gotoApp(page);
    await selectWorkspaceTab(page, screen);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
    expect(blocking, blocking.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
  });
}
