// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
import { WORKLOADS } from '../engine/catalog';
import { PRESETS } from '../engine/presets';

afterEach(cleanup);

describe('App', () => {
  it('renders the three numbered panels', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Your fleet/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Signature match/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Your blind window/i })).toBeTruthy();
  });

  it('cites the advisory it is built on', () => {
    render(<App />);
    const links = screen.getAllByRole('link', { name: /AA26-251A/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].getAttribute('href')).toContain('cisa.gov');
  });

  it('offers every preset as a button', () => {
    render(<App />);
    for (const p of PRESETS) {
      expect(screen.getByRole('button', { name: p.name })).toBeTruthy();
    }
  });

  it('lists every workload with a checkbox', () => {
    render(<App />);
    for (const w of WORKLOADS) {
      expect(screen.getByLabelText(w.name)).toBeTruthy();
    }
  });

  it('starts on the first preset with its workloads ticked', () => {
    render(<App />);
    for (const id of PRESETS[0].fleet.enabled) {
      const w = WORKLOADS.find((x) => x.id === id)!;
      expect((screen.getByLabelText(w.name) as HTMLInputElement).checked).toBe(true);
    }
  });

  it('moves the signature score when a workload is toggled off', () => {
    render(<App />);
    const scoreEl = screen.getByLabelText('Overall signature match');
    const before = scoreEl.textContent;
    fireEvent.click(screen.getByLabelText('One API key shared across the team'));
    expect(screen.getByLabelText('Overall signature match').textContent).not.toBe(before);
  });

  it('switches to Custom once the fleet is edited', () => {
    render(<App />);
    expect(screen.queryByText('Custom')).toBeNull();
    fireEvent.click(screen.getByLabelText('Nightly regression eval suite'));
    expect(screen.getByText('Custom')).toBeTruthy();
  });

  it('restores a preset after a custom edit', () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText('Nightly regression eval suite'));
    fireEvent.click(screen.getByRole('button', { name: PRESETS[0].name }));
    expect(screen.queryByText('Custom')).toBeNull();
    expect(
      (screen.getByLabelText('Nightly regression eval suite') as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('expands an indicator to show the advisory text and the mitigation', () => {
    render(<App />);
    const head = screen.getByRole('button', { name: /Shared account|One credential, many/i });
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/Why yours does this anyway/i)).toBeTruthy();
    expect(screen.getByText(/Cheapest fix/i)).toBeTruthy();
  });

  it('reports no detectable change when nothing is altered', () => {
    render(<App />);
    fireEvent.change(
      screen.getByRole('slider', { name: /Share of responses altered/i }),
      { target: { value: '0' } },
    );
    // The readout hero, the first-flag figure and the verdict line all say so.
    expect(screen.getAllByText('never').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/nothing for the suite to find/i)).toBeTruthy();
    // The "one run is a signal, not a finding" aside is meaningless here.
    expect(screen.queryByText(/is a signal, not a finding/i)).toBeNull();
  });

  it('shortens the blind window when the suite grows', () => {
    render(<App />);
    const readout = () =>
      screen.getByText(/before your suite could tell this apart/i).parentElement!;
    const cases = () => screen.getByRole('slider', { name: /Cases per run/i });
    fireEvent.change(cases(), { target: { value: '20' } });
    const small = within(readout()).getByText(/day|month|year|never/i).textContent;
    fireEvent.change(cases(), { target: { value: '2000' } });
    const large = within(readout()).getByText(/day|month|year|never/i).textContent;
    expect(large).not.toBe(small);
    expect(small).not.toBe('under a day');
  });

  it('rewrites the verdict line as the fleet changes', () => {
    render(<App />);
    const verdict = () => screen.getByText(/published indicators firing/i).textContent!;
    const before = verdict();
    fireEvent.click(screen.getByRole('button', { name: PRESETS[3].name }));
    expect(verdict()).not.toBe(before);
  });

  it('lowers the score when the same traffic moves to an enterprise agreement', () => {
    render(<App />);
    const score = () =>
      Number(screen.getByLabelText('Overall signature match').textContent!.replace('%', ''));
    fireEvent.click(screen.getByRole('button', { name: 'Individual seat' }));
    const individual = score();
    fireEvent.click(screen.getByRole('button', { name: 'Enterprise agreement' }));
    expect(score()).toBeLessThan(individual);
  });

  it('states plainly that it is not a prediction', () => {
    render(<App />);
    expect(screen.getByText(/It is not a prediction/i)).toBeTruthy();
  });
});
