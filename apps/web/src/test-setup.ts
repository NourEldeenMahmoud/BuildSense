export {};

if (typeof document !== 'undefined') {
  await import('zone.js');
  await import('zone.js/' + 'testing');
  const { getTestBed } = await import('@angular/core/testing');
  const { BrowserDynamicTestingModule, platformBrowserDynamicTesting } =
    await import('@angular/platform-browser-dynamic/testing');
  getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
}
