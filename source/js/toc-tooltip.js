(() => {
  const processed = new WeakSet();
  let tooltip;
  let activeLink;

  const ensureTooltip = () => {
    if (tooltip) return tooltip;

    tooltip = document.createElement('div');
    tooltip.className = 'toc-title-tooltip';
    tooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltip);
    return tooltip;
  };

  const getLinkTitle = link => {
    const text = link.querySelector('.nav-text')?.textContent || link.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
  };

  const isTruncated = link => link.scrollWidth > link.clientWidth + 1;

  const placeTooltip = link => {
    const tip = ensureTooltip();
    const rect = link.getBoundingClientRect();
    const gap = 10;
    const margin = 12;
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    let left = rect.right + gap;
    let top = rect.top + rect.height / 2;

    if (left + width + margin > window.innerWidth) {
      left = rect.left - width - gap;
    }

    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    top = Math.max(margin + height / 2, Math.min(top, window.innerHeight - height / 2 - margin));

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };

  const showTooltip = link => {
    const title = getLinkTitle(link);
    if (!title || !isTruncated(link)) return;

    const tip = ensureTooltip();
    activeLink = link;
    tip.textContent = title;
    tip.classList.add('is-visible');
    placeTooltip(link);
  };

  const hideTooltip = link => {
    if (link && activeLink !== link) return;

    activeLink = null;
    if (tooltip) tooltip.classList.remove('is-visible');
  };

  const bindLink = link => {
    if (processed.has(link)) return;

    processed.add(link);
    const title = getLinkTitle(link);
    if (title) {
      link.setAttribute('aria-label', title);
    }

    link.addEventListener('mouseenter', () => showTooltip(link));
    link.addEventListener('focus', () => showTooltip(link));
    link.addEventListener('mouseleave', () => hideTooltip(link));
    link.addEventListener('blur', () => hideTooltip(link));
  };

  const init = () => {
    document.querySelectorAll('.post-toc .nav-link').forEach(bindLink);
  };

  const refreshPosition = () => {
    if (activeLink) placeTooltip(activeLink);
  };

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pjax:success', init);
  document.addEventListener('pjax:end', init);
  window.addEventListener('load', init);
  window.addEventListener('resize', refreshPosition, { passive: true });
  window.addEventListener('scroll', refreshPosition, { passive: true });

  new MutationObserver(init).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  init();
})();
