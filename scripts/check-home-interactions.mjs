import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Component-level DOM checks. This does not launch or control a browser.
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://poket.test", pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "Element", "Node", "MouseEvent", "KeyboardEvent"]) globalThis[key] = dom.window[key];
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = query => ({ matches: query.includes("prefers-reduced-motion"), media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
const { default: React, createElement, act } = await import("react");
globalThis.React = React;
const { createRoot } = await import("react-dom/client");
const { default: AudienceExplorer } = await import("../components/poket-home/AudienceExplorer.tsx");
const { default: Testimonials } = await import("../components/poket-home/Testimonials.tsx");
const { PricingCards: Pricing } = await import("../components/poket-home/Pricing.tsx");
const container = document.getElementById("root");
let root;
async function mount(Component, props) { if (root) await act(() => root.unmount()); root = createRoot(container); await act(() => root.render(createElement(Component, props))); }
async function click(element) { assert.ok(element, "Expected control exists"); await act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true }))); }
const labelled = label => container.querySelector(`[aria-label="${label}"]`);
const textButton = text => [...container.querySelectorAll("button")].find(button => button.textContent.includes(text));

await mount(AudienceExplorer);
assert.equal(container.querySelector('[role="tab"][aria-selected="true"]').id, "audience-tab-students");
await click(container.querySelector("#audience-tab-parents"));
assert.match(container.querySelector(".audience-explorer__title").textContent, /See the week/);
assert.equal(container.querySelector(".audience-explorer__action a").getAttribute("href"), "/signup?role=parent");
await act(() => container.querySelector("#audience-tab-parents").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
assert.equal(container.querySelector('[aria-selected="true"]').id, "audience-tab-teachers");
assert.equal(document.activeElement.id, "audience-tab-teachers");
assert.match(container.querySelector(".audience-explorer__action a").href, /\/institutions$/);
await act(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
assert.equal(container.querySelector('[aria-selected="true"]').id, "audience-tab-students");
assert.equal(container.querySelectorAll('[role="tab"][tabindex="0"]').length, 1);
console.log("PASS: audience switching, matching content/CTAs, arrow keys, Home and roving focus");

await mount(Testimonials);
await click(labelled("Next story"));
assert.match(container.querySelector("blockquote").textContent, /goals, attendance/);
await click(labelled("Next story"));
assert.match(container.querySelector("blockquote").textContent, /plan lessons/);
await click(labelled("Next story"));
assert.match(container.querySelector("blockquote").textContent, /When I’m stuck/);
await click(labelled("Previous story"));
assert.match(container.querySelector("blockquote").textContent, /plan lessons/);
await click(labelled("Show students story"));
await act(() => labelled("Illustrative learner stories").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
assert.equal(container.querySelector('[aria-roledescription="slide"]').getAttribute("aria-label"), "2 of 3");
await act(() => { const element = labelled("Illustrative learner stories"); element.dispatchEvent(new MouseEvent("pointerdown", { clientX: 300, bubbles: true })); element.dispatchEvent(new MouseEvent("pointerup", { clientX: 100, bubbles: true })); });
assert.match(container.querySelector("blockquote").textContent, /plan lessons/);
assert.match(container.querySelector(".stories__disclosure").textContent, /Illustrative learner perspectives/);
console.log("PASS: carousel next/previous/wrap, dots, keyboard, swipe and sample disclosure");

const { seedPricing } = await import("../lib/pricing.ts");
const config = seedPricing();
await mount(Pricing, { config, currency: "USD" });
const plan = name => container.querySelector(`[data-plan="${name}"]`);
assert.equal(plan("primary_secondary").querySelector(".pricing-explorer__amount").textContent, "Coming soon");
assert.match(plan("igcse_alevel").querySelector(".pricing-explorer__amount").textContent, /79/);
await click(textButton("Annually"));
assert.match(plan("igcse_alevel").querySelector(".pricing-explorer__amount").textContent, /708/);
assert.match(plan("igcse_alevel").querySelector(".pricing-explorer__price").textContent, /year/);
assert.match(plan("igcse_alevel").querySelector(".pricing-explorer__billing-note").textContent, /Billed annually/);
assert.match(plan("preview").querySelector(".pricing-explorer__amount").textContent, /0/);
assert.equal(plan("preview").querySelector("a").getAttribute("href"), "/signup");
assert.equal(plan("igcse_alevel").querySelector("a").getAttribute("href"), "/pricing?billing=annual#plan-igcse_alevel");
await click(textButton("Monthly"));
assert.match(plan("igcse_alevel").querySelector(".pricing-explorer__amount").textContent, /79/);
console.log("PASS: live plan IDs, configured annual amount, unset prices, billing labels and local actions");
await act(() => root.unmount());
dom.window.close();
process.exit(0);
