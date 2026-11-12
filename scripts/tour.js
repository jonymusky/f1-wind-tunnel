// Feature tour driven inside the real app, recorded by scripts/record-tour.sh.
// It only clicks and types what a visitor could: every step is a real control.
;(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const byText = (sel, text) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === text || e.getAttribute("aria-label") === text)
  const click = (sel, text) => {
    const el = byText(sel, text)
    if (!el) throw new Error(`tour: no ${sel} "${text}"`)
    el.click()
  }
  const radio = (text) => click("[role=radio]", text)
  // Sliders are moved the way a keyboard user would: one arrow press per step
  const slide = async (label, steps, pause = 55) => {
    const thumb = document.querySelector(`[role=slider][aria-label="${label}"]`)
    if (!thumb) throw new Error(`tour: no slider "${label}"`)
    thumb.focus()
    for (let i = 0; i < Math.abs(steps); i++) {
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key: steps > 0 ? "ArrowRight" : "ArrowLeft", bubbles: true }))
      await wait(pause)
    }
    thumb.blur()
  }

  const bar = document.createElement("div")
  bar.style.cssText =
    "position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:9999;padding:12px 22px;border-radius:12px;background:rgba(11,12,15,.9);border:1px solid #353841;color:#ecedf0;font:600 22px/1.2 var(--font-inter),system-ui,sans-serif;letter-spacing:-.01em;white-space:nowrap;transition:opacity .25s;opacity:0;box-shadow:0 12px 40px rgba(0,0,0,.6)"
  document.body.append(bar)
  const caption = async (text) => {
    bar.style.opacity = "0"
    await wait(260)
    bar.textContent = text
    bar.style.opacity = "1"
  }

  // ---- wind tunnel ----
  await caption("A Formula 1 car in the wind tunnel")
  await wait(3200)

  await caption("Trim the wings, ride height and rake")
  await slide("Rear wing angle", 12)
  await slide("Front wing flap", 8)
  await wait(500)
  await slide("Ride height", -15, 45)
  await wait(1700)
  await slide("Ride height", 15, 25)
  await slide("Rear wing angle", -12, 25)
  await slide("Front wing flap", -8, 25)

  await caption("Read the surface pressure, or follow a smoke wand")
  document.querySelector("[role=switch]").click()
  await wait(2600)
  document.querySelector("[role=switch]").click()
  radio("Smoke wand")
  await wait(2600)
  radio("Streamlines")

  await caption("Yaw the car into a crosswind, open the flaps")
  await slide("Yaw", 12, 60)
  await wait(900)
  await slide("Yaw", -12, 30)
  radio("Straight mode")
  await wait(1800)
  radio("Corner mode")

  await caption("Look at it from any side")
  for (const view of ["Side", "Top", "Floor", "3/4"]) {
    radio(view)
    await wait(1300)
  }

  await caption("Paint it in your team's colours")
  for (const team of ["Ferrari", "Mercedes", "Aston Martin", "McLaren"]) {
    radio(team)
    await wait(1000)
  }

  await caption("Take it apart: fourteen components explained")
  click("button", "Explode")
  await wait(2600)
  byText("button, li", "Floor & diffuser")?.click() ?? [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Floor & diffuser"))?.click()
  await wait(2800)
  click("button", "Assemble")
  await wait(900)

  // ---- race track ----
  await caption("Then drive the same setup on a Grand Prix circuit")
  ;[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Drive it")).click()
  await wait(900)
  radio("4×")
  await wait(4200)

  await caption("Twelve circuits, each with its own demands")
  for (const circuit of ["Suzuka", "Spa", "Monza"]) {
    click("[role=tab]", circuit)
    await wait(2000)
  }

  await caption("Find the fastest wing angles for each one")
  ;[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Find the fastest")).click()
  await wait(3600)

  await caption("See what limits the car at every point of the lap")
  radio("by limit")
  await wait(3600)
  radio("Colour by speed")

  await caption("Change power, weight, fuel and tyres: the lap time answers")
  await slide("Power", -24, 40)
  await wait(700)
  await slide("Fuel", 60, 18)
  await wait(700)
  radio("Hard")
  await wait(1400)
  radio("Soft")
  await slide("Fuel", -60, 8)
  await slide("Power", 24, 15)
  await wait(900)

  bar.style.opacity = "0"
  await wait(500)
  window.__tourDone = true
})().catch((err) => {
  console.error(err)
  window.__tourDone = String(err)
})
