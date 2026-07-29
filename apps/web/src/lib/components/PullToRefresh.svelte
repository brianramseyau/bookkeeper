<script lang="ts">
  // iOS (Safari and other WKWebView-based browsers) has no native
  // pull-to-refresh gesture, unlike Android Chrome - most noticeable when
  // the app is installed to the home screen (see manifest.json's
  // "standalone" display), where there's no browser chrome reload button
  // either. This re-implements the gesture so iOS gets the same behavior.
  const PULL_THRESHOLD = 80
  const MAX_PULL = 120

  function isIos(): boolean {
    if (typeof navigator === 'undefined') return false
    const isAppleTouchDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
    // iPadOS reports as "MacIntel" but, unlike a real Mac, has touch support.
    const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
    return isAppleTouchDevice || isIpadOs
  }

  const shouldAttach = isIos()

  let active = false
  let startY = 0
  let pulling = $state(false)
  let refreshing = $state(false)
  let pullDistance = $state(0)

  function reset() {
    active = false
    pulling = false
    pullDistance = 0
  }

  function handleTouchStart(event: TouchEvent) {
    if (!shouldAttach || refreshing || window.scrollY > 0) return
    active = true
    startY = event.touches[0]?.clientY ?? 0
  }

  function handleTouchMove(event: TouchEvent) {
    if (!active || refreshing) return
    if (window.scrollY > 0) {
      reset()
      return
    }
    const currentY = event.touches[0]?.clientY ?? 0
    const delta = currentY - startY
    if (delta <= 0) {
      pulling = false
      pullDistance = 0
      return
    }
    pulling = true
    pullDistance = Math.min(delta, MAX_PULL)
  }

  function handleTouchEnd() {
    if (!active) return
    if (pulling && pullDistance >= PULL_THRESHOLD) {
      active = false
      pulling = false
      refreshing = true
      location.reload()
    } else {
      reset()
    }
  }
</script>

<svelte:window
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  ontouchcancel={handleTouchEnd}
/>

{#if shouldAttach}
  {#if pulling || refreshing}
    <div
      class="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center overflow-hidden"
      style="height: {refreshing ? 48 : pullDistance}px"
    >
      <div class="flex items-center pt-2.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          class="size-5 text-indigo-600 dark:text-indigo-400 {refreshing ? 'animate-spin' : ''}"
          style={refreshing
            ? ''
            : `transform: rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`}
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.5a.75.75 0 0 0-1.5 0v4.69L7.03 9.97a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 1 0-1.06-1.06l-2.22 2.22V6.5Z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </div>
  {/if}
{/if}
