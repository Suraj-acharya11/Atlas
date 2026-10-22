
const { remote } = require('webdriverio');
const assert = require('node:assert/strict');

describe('ATLAS Android UI Tests', function () {
  this.timeout(30000);

  let driver;

  before(async function () {
    driver = await remote({
      hostname: '127.0.0.1',
      port: 4723,
      path: '/',
      capabilities: {
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:udid': '192.168.0.100:35583',
        'appium:appPackage': 'com.anonymous.atlasv1',
        'appium:appActivity': 'com.anonymous.atlasv1.MainActivity',
        'appium:noReset': true
      }
    });
  });

  // AT-01: Verify that a Today’s Plan task is displayed
  it('AT-01: Today’s Plan task is displayed', async function () {
    const task = await driver.$(
      'android=new UiSelector().text("Week 7 - All Pair Shortest Path")'
    );

    await task.waitForDisplayed({ timeout: 15000 });

    assert.equal(
      await task.isDisplayed(),
      true,
      'Today’s Plan task should be visible'
    );
  });

  // AT-02: Verify that a nonexistent dashboard element is not displayed
  it('AT-02: Non-existent dashboard element is not displayed', async function () {
    const wrongElement = await driver.$(
      'android=new UiSelector().text("NON_EXISTENT_ATLAS_ELEMENT")'
    );

    const isDisplayed = await wrongElement.isDisplayed();

    assert.equal(
      isDisplayed,
      false,
      'A non-existent dashboard element should not be visible'
    );
  });


  // AT-03: Test the Full Timetable button interaction
  it('AT-03: Full Timetable button responds to a tap', async function () {
    const timetableButton = await driver.$(
      'android=new UiSelector().description("Full Timetable ›")'
    );

    await timetableButton.waitForDisplayed({ timeout: 10000 });
    await timetableButton.click();

    // Check whether the original dashboard button disappears.
    await timetableButton.waitForDisplayed({
      timeout: 5000,
      reverse: true
    });

    assert.equal(
      await timetableButton.isDisplayed().catch(() => false),
      false,
      'The Full Timetable button should disappear after navigation'
    );
  });

  after(async function () {
    if (driver) {
      await driver.deleteSession();
    }
  });
});
