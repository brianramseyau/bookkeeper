<script lang="ts">
  interface Props {
    class?: string
  }

  let { class: className = 'h-40 w-40' }: Props = $props()
</script>

<svg
  viewBox="0 0 200 160"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  class={className}
  role="img"
  aria-label="A confused piggy bank looking for the missing page"
>
  <ellipse cx="100" cy="148" rx="56" ry="8" class="fill-slate-200 dark:fill-slate-800" />

  <path
    d="M46 104c-7-1-12-8-8-15s13-5 11 2"
    class="stroke-indigo-400 dark:stroke-indigo-500"
    stroke-width="4"
    stroke-linecap="round"
    stroke-linejoin="round"
  />

  <rect x="66" y="124" width="12" height="22" rx="5" class="fill-indigo-400 dark:fill-indigo-600" />
  <rect x="84" y="128" width="12" height="18" rx="5" class="fill-indigo-400 dark:fill-indigo-600" />
  <rect
    x="104"
    y="128"
    width="12"
    height="18"
    rx="5"
    class="fill-indigo-400 dark:fill-indigo-600"
  />
  <rect
    x="122"
    y="124"
    width="12"
    height="22"
    rx="5"
    class="fill-indigo-400 dark:fill-indigo-600"
  />

  <ellipse
    cx="100"
    cy="98"
    rx="54"
    ry="38"
    class="fill-indigo-100 stroke-indigo-400 dark:fill-indigo-900/40 dark:stroke-indigo-500"
    stroke-width="4"
  />

  <path
    d="M53 79 38 42 86 61Z"
    class="fill-indigo-200 stroke-indigo-400 dark:fill-indigo-800 dark:stroke-indigo-500"
    stroke-width="3"
    stroke-linejoin="round"
  />
  <path
    d="M147 79 162 42 114 61Z"
    class="fill-indigo-200 stroke-indigo-400 dark:fill-indigo-800 dark:stroke-indigo-500"
    stroke-width="3"
    stroke-linejoin="round"
  />

  <ellipse
    cx="100"
    cy="106"
    rx="22"
    ry="15"
    class="fill-indigo-200 stroke-indigo-400 dark:fill-indigo-800 dark:stroke-indigo-500"
    stroke-width="3"
  />
  <ellipse cx="92" cy="106" rx="3" ry="4" class="fill-indigo-500 dark:fill-indigo-300" />
  <ellipse cx="108" cy="106" rx="3" ry="4" class="fill-indigo-500 dark:fill-indigo-300" />

  <path
    d="M70 82l11 10M92 82l-11 10"
    class="stroke-slate-600 dark:stroke-slate-300"
    stroke-width="3"
    stroke-linecap="round"
  />
  <path
    d="M116 76c4-4 13-4 17 0"
    class="stroke-slate-600 dark:stroke-slate-300"
    stroke-width="3"
    stroke-linecap="round"
  />
  <circle cx="124" cy="88" r="3.5" class="fill-slate-600 dark:fill-slate-300" />

  <ellipse cx="100" cy="122" rx="4.5" ry="5.5" class="fill-slate-600 dark:fill-slate-300" />

  <g class="stroke-slate-400 dark:stroke-slate-500" stroke-width="4" stroke-linecap="round">
    <circle cx="170" cy="72" r="14" class="fill-white dark:fill-slate-900" />
    <line x1="180" y1="82" x2="191" y2="93" />
  </g>

  <text
    x="16"
    y="32"
    class="fill-indigo-400 dark:fill-indigo-400"
    font-size="20"
    font-weight="700"
    font-family="sans-serif">?</text
  >
</svg>
