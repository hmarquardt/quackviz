const AxeBuilder = require("@axe-core/playwright").default;
const { test, expect, gotoApp, selectWorkspaceTab } = require("../fixtures");

for (const screen of ["data", "sql", "visualize", "dashboard", "report", "ai", "debug"]) {
  test(`${screen} screen has no serious or critical axe violations`, async ({ page }) => {
    await gotoApp(page);
    await selectWorkspaceTab(page, screen);
    const results = await new AxeBuilder({ page }).analyze();
    const counts = Object.fromEntries(["critical", "serious", "moderate", "minor"].map((impact) => [
      impact,
      results.violations.filter((violation) => violation.impact === impact).length,
    ]));
    console.log(`AXE_RESULT browser=${test.info().project.name} screen=${screen} ${Object.entries(counts).map(([impact, count]) => `${impact}=${count}`).join(" ")}`);
    for (const violation of results.violations.filter((item) => ["moderate", "minor"].includes(item.impact))) {
      console.log(`AXE_FINDING browser=${test.info().project.name} screen=${screen} impact=${violation.impact} rule=${violation.id}`);
    }
    const blocking = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
    expect(blocking, blocking.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
  });
}
