import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import PageHead from './PageHead.svelte'

describe('PageHead', () => {
  it('sets the document title with the Bookkeeper suffix', () => {
    render(PageHead, { title: 'Income' })
    expect(document.title).toBe('Income · Bookkeeper')
  })
})
