import test from "node:test";
import assert from "node:assert/strict";
import { UIManager } from "../public/js/ui-manager.js";

test("shows an actionable message for shelves over 2,000 books", () => {
  const originalConsoleError = console.error;
  const manager = Object.create(UIManager.prototype);
  let displayedMessage = "";
  manager.setProgressText = message => {
    displayedMessage = message;
  };
  manager.resetProgress = () => {};
  manager.showCard = () => {};
  console.error = () => {};

  try {
    manager.showError(new Error(
      "This shelf contains more than 2,000 books and cannot be loaded completely."
    ));

    assert.equal(
      displayedMessage,
      "This shelf has more than 2,000 books and cannot be displayed completely."
    );
  } finally {
    console.error = originalConsoleError;
  }
});