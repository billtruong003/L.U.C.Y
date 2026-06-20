#!/usr/bin/env node
/**
 * puppeteer-screenshot.js — ABF-5
 * Usage: node puppeteer-screenshot.js <base_url> <screens_json> <output_dir>
 * screens_json: JSON array of {name, url, viewport?:[w,h], wait_selector?, full_page?}
 * Output: JSON array [{name, path, ok, bytes?, error?}] to stdout
 *
 * Runs from /root/lucy/tools/ (node_modules/puppeteer here).
 */
'use strict'

const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')

async function run(baseUrl, screens, outputDir) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    headless: true,
  })

  const results = []
  for (const screen of screens) {
    const page = await browser.newPage()
    const [w, h] = screen.viewport || [1280, 800]
    await page.setViewport({ width: w, height: h })

    let ok = false
    let errMsg = null
    const outPath = path.join(outputDir, `${screen.name}.png`)

    try {
      await page.goto(baseUrl + screen.url, { waitUntil: 'networkidle2', timeout: 15000 })
      if (screen.wait_selector) {
        await page.waitForSelector(screen.wait_selector, { timeout: 5000 }).catch(() => {})
      }
      await page.screenshot({ path: outPath, fullPage: screen.full_page || false })
      ok = true
    } catch (e) {
      errMsg = e.message || String(e)
    }

    const bytes = ok ? (fs.existsSync(outPath) ? fs.statSync(outPath).size : 0) : 0
    results.push({ name: screen.name, path: outPath, ok, bytes, ...(errMsg ? { error: errMsg } : {}) })
    await page.close()
  }

  await browser.close()
  return results
}

async function main() {
  const [, , baseUrl, screensJson, outputDir = '/tmp'] = process.argv
  if (!baseUrl || !screensJson) {
    process.stderr.write('Usage: node puppeteer-screenshot.js <base_url> <screens_json> <output_dir>\n')
    process.exit(1)
  }

  let screens
  try {
    screens = JSON.parse(screensJson)
  } catch (e) {
    process.stderr.write(`screens_json parse error: ${e.message}\n`)
    process.exit(1)
  }

  fs.mkdirSync(outputDir, { recursive: true })

  try {
    const results = await run(baseUrl, screens, outputDir)
    process.stdout.write(JSON.stringify(results) + '\n')
  } catch (e) {
    process.stderr.write(`puppeteer error: ${e.message}\n`)
    process.stdout.write(JSON.stringify(screens.map(s => ({ name: s.name, path: '', ok: false, error: e.message }))) + '\n')
    process.exit(1)
  }
}

main()
