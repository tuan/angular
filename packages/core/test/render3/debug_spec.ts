/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {getLContext} from '../../src/render3/context_discovery';
import {LViewDebug, toDebug} from '../../src/render3/debug';
import {RenderFlags, defineComponent, elementEnd, elementStart, text} from '../../src/render3/index';

import {ComponentFixture} from './render_util';

describe('Debug Representation', () => {
  it('should generate a human readable version', () => {
    class MyComponent {
      static ngComponentDef = defineComponent({
        type: MyComponent,
        selectors: [['my-comp']],
        vars: 0,
        consts: 2,
        factory: () => new MyComponent(),
        template: function(rf: RenderFlags, ctx: MyComponent) {
          if (rf == RenderFlags.Create) {
            elementStart(0, 'div', ['id', '123']);
            text(1, 'Hello World');
            elementEnd();
          }
        }
      });
    }

    const fixture = new ComponentFixture(MyComponent);
    const hostView = toDebug(getLContext(fixture.component) !.lView);
    expect(hostView.host).toEqual(null);
    const myCompView = hostView.childViews[0] as LViewDebug;
    expect(myCompView.host).toEqual('<div host="mark"><div id="123">Hello World</div></div>');
    expect(myCompView.nodes ![0].html).toEqual('<div id="123">');
    expect(myCompView.nodes ![0].nodes ![0].html).toEqual('Hello World');
  });
});
