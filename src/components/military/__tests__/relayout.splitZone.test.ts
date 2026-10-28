// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { splitZone } from '../relayout';

describe('splitZone', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('区画を隠し、光エンジンの属性を外した複製を 左 / 右 / 台車 の 3 枚置く。restore で元どおり', () => {
    const app = document.createElement('div');
    const z = document.createElement('div');
    z.setAttribute('data-ms-zone', 'vent');
    z.innerHTML = '<div class="milspec-vent"><svg><path data-trace="a" data-trace-pc="seam"/></svg><i data-bus="b"></i>'
      + '<div data-vent-rail></div><div class="milspec-carriage" data-vent-carriage><b></b></div></div>';
    app.append(z); document.body.append(app);
    const s = splitZone(z, 190);
    expect(z.style.visibility).toBe('hidden');
    for (const c of [s.left, s.right, s.carriage!]) {
      expect(c.classList.contains('milspec-split')).toBe(true);
      expect(c.hasAttribute('inert')).toBe(true);
      expect(c.getAttribute('aria-hidden')).toBe('true');
      expect(c.hasAttribute('data-ms-zone')).toBe(false);
      expect(c.style.pointerEvents).toBe('none');
      expect(c.style.position).toBe('absolute');
      expect(c.querySelector('[data-trace],[data-trace-pc],[data-bus]')).toBeNull();
    }
    // 台車は左右の複製から外れ、台車の複製には台車だけが残る
    expect(s.left.querySelector('[data-vent-carriage]')).toBeNull();
    expect(s.right.querySelector('[data-vent-carriage]')).toBeNull();
    expect(s.right.querySelector('[data-vent-rail]')).not.toBeNull();
    expect(s.carriage!.querySelector('[data-vent-carriage]')).not.toBeNull();
    expect(s.carriage!.querySelector('[data-vent-rail], svg')).toBeNull();
    // 元の区画の属性は残る
    expect(z.querySelector('[data-trace]')).not.toBeNull();
    s.restore();
    expect(app.querySelector('.milspec-split')).toBeNull();
    expect(z.style.visibility).toBe('');
  });

  it('電源投入の演出: 暗幕(不透明度・切り抜き)とランプは毎コマ本物に合わせる', () => {
    vi.useFakeTimers();
    try {
      const app = document.createElement('div');
      const z = document.createElement('div');
      z.innerHTML = '<div class="milspec-vent"><i class="milspec-led is-warn"></i><div class="milspec-carriage" data-vent-carriage><i class="milspec-led"></i></div></div>'
        + '<span class="milspec-dim"></span>';
      app.append(z); document.body.append(app);
      const box = (l: number, t: number, w: number, h: number) => () => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t, toJSON() {} }) as DOMRect;
      z.getBoundingClientRect = box(300, 104, 1189, 19);
      const dim = z.querySelector('.milspec-dim') as HTMLElement;
      dim.getBoundingClientRect = box(300, 104, 1189, 19);
      dim.style.opacity = '0.55';
      dim.style.clipPath = 'inset(0px 0px 0px calc(50% + 0px))'; // 暗幕が退いた左半分は明るい(暗幕は右半分だけ)
      const s = splitZone(z, 190);
      // 複製の暗幕は、本物の暗幕が覆っている画面上の範囲を、複製の位置に直して覆う(作った直後から)
      const ld = s.left.querySelector('.milspec-dim') as HTMLElement;
      expect(ld.style.opacity).toBe('0.55');
      expect(ld.style.clipPath).toBe('inset(104px -1489px -123px 894.5px)'); // 複製の暗幕の矩形は 0(テストの代役)
      ld.getBoundingClientRect = box(300, 104, 1189, 19);
      // 台車の複製の暗幕は台車の範囲だけ(右の複製の暗幕と二重にならない)
      const car = s.carriage!.querySelector('[data-vent-carriage]') as HTMLElement;
      car.getBoundingClientRect = box(1000, 104, 252, 19);
      const cd = s.carriage!.querySelector('.milspec-dim') as HTMLElement;
      cd.getBoundingClientRect = box(300, 104, 1189, 19);
      // 本物が進む(暗幕が消えていく・ランプが点く)と、次のコマで複製も同じになる
      dim.style.opacity = '0.3';
      (z.querySelector('.milspec-vent > .milspec-led') as HTMLElement).className = 'milspec-led is-on is-flick';
      vi.advanceTimersByTime(20);
      expect(ld.style.opacity).toBe('0.3');
      expect(ld.style.clipPath).toBe('inset(0px 0px 0px 594.5px)');
      expect(cd.style.clipPath).toBe('inset(0px 237px 0px 700px)');
      expect((s.right.querySelector('.milspec-vent > .milspec-led') as HTMLElement).className).toBe('milspec-led is-on is-flick');
      // 台車が暗幕の外(左の明るい側)にいるときは、台車の暗幕は覆わない
      car.getBoundingClientRect = box(500, 104, 252, 19);
      vi.advanceTimersByTime(20);
      expect(cd.style.clipPath).toBe('inset(50%)');
      s.restore();
    } finally { vi.useRealTimers(); }
  });

  it('台車の無い区画では carriage は null', () => {
    const app = document.createElement('div');
    const z = document.createElement('div');
    app.append(z); document.body.append(app);
    expect(splitZone(z, 700).carriage).toBeNull();
  });

  it('複製の SVG の id は複製ごとに付け直し、url(#…) / href の参照も複製の中の定義を指す(本物は隠すので、本物の pattern・clipPath を参照すると網・基板が消える)', () => {
    const app = document.createElement('div');
    const z = document.createElement('div');
    z.innerHTML = '<svg><defs><pattern id="hdr-1-mesh"></pattern><clipPath id="hdr-2-win"><rect/></clipPath></defs>'
      + '<rect fill="url(#hdr-1-mesh)" style="fill:url(&quot;#hdr-1-mesh&quot;)"/><g clip-path="url(#hdr-2-win)"></g><use href="#hdr-1-mesh"/></svg>';
    app.append(z); document.body.append(app);
    const s = splitZone(z, [{ x: 700, y0: 0, y1: 102 }]);
    const ids = (c: HTMLElement) => [...c.querySelectorAll('[id]')].map((e) => e.id);
    for (const c of [s.left, s.right]) {
      const [mesh, win] = ids(c);
      expect(mesh).not.toBe('hdr-1-mesh'); expect(win).not.toBe('hdr-2-win');
      expect(mesh.startsWith('hdr-1-mesh')).toBe(true);
      expect(c.querySelector('rect[fill]')!.getAttribute('fill')).toBe(`url(#${mesh})`);
      expect(c.querySelector('rect[fill]')!.getAttribute('style')).toContain(`#${mesh}`);
      expect(c.querySelector('g')!.getAttribute('clip-path')).toBe(`url(#${win})`);
      expect(c.querySelector('use')!.getAttribute('href')).toBe(`#${mesh}`);
    }
    expect(ids(s.left)[0]).not.toBe(ids(s.right)[0]);
    // 本物はそのまま
    expect(z.querySelector('rect[fill]')!.getAttribute('fill')).toBe('url(#hdr-1-mesh)');
    s.restore();
  });

  it('ヘッダーの右の複製は左の縁の影(near-l / far-l)を持たない(滑る影と二重にならない)。走行中の粒も複製には持ち込まない', () => {
    const app = document.createElement('div');
    const z = document.createElement('div');
    z.innerHTML = '<svg><g class="drw-shadow"><rect data-sh="near-l"/><rect data-sh="far-l"/><rect data-sh="near-r"/><rect data-sh="far-r"/></g>'
      + '<path class="milspec-pz-g"/><path class="milspec-pz-c"/></svg>';
    app.append(z); document.body.append(app);
    const s = splitZone(z, [{ x: 700, y0: 0, y1: 102 }]);
    expect(s.right.querySelectorAll('[data-sh="near-l"], [data-sh="far-l"]')).toHaveLength(0);
    expect(s.right.querySelectorAll('[data-sh="near-r"], [data-sh="far-r"]')).toHaveLength(2);
    for (const c of [s.left, s.right]) expect(c.querySelectorAll('.milspec-pz-g, .milspec-pz-c')).toHaveLength(0);
    expect(z.querySelectorAll('.milspec-pz-g')).toHaveLength(1); // 本物はそのまま
    s.restore();
  });
});
