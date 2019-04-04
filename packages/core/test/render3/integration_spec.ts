/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ElementRef, TemplateRef, ViewContainerRef} from '@angular/core';

import {RendererType2} from '../../src/render/api';
import {AttributeMarker, defineComponent, defineDirective, templateRefExtractor} from '../../src/render3/index';

import {allocHostVars, bind, container, containerRefreshEnd, containerRefreshStart, elementStart, elementAttribute, elementClassProp, elementContainerEnd, elementContainerStart, elementEnd, elementProperty, element, elementStyling, elementStylingApply, elementStyleProp, embeddedViewEnd, embeddedViewStart, interpolation1, interpolation2, interpolation3, interpolation4, interpolation5, interpolation6, interpolation7, interpolation8, interpolationV, projection, projectionDef, reference, text, textBinding, template, elementStylingMap, directiveInject, elementHostAttrs, elementHostStyleProp, elementHostStyling, elementHostClassProp, elementHostStylingApply, elementHostStylingMap} from '../../src/render3/instructions/all';
import {RenderFlags} from '../../src/render3/interfaces/definition';
import {RElement, Renderer3, RendererFactory3, domRendererFactory3} from '../../src/render3/interfaces/renderer';
import {HEADER_OFFSET, CONTEXT} from '../../src/render3/interfaces/view';
import {enableBindings, disableBindings} from '../../src/render3/state';
import {sanitizeUrl} from '../../src/sanitization/sanitization';
import {Sanitizer, SecurityContext} from '../../src/sanitization/security';

import {NgIf} from './common_with_def';
import {ComponentFixture, MockRendererFactory, TemplateFixture, createComponent, renderToHtml} from './render_util';
import {getLContext} from '../../src/render3/context_discovery';
import {StylingIndex} from '../../src/render3/interfaces/styling';
import {MONKEY_PATCH_KEY_NAME} from '../../src/render3/interfaces/context';

describe('render3 integration test', () => {

  describe('render', () => {

    it('should render basic template', () => {
      expect(renderToHtml(Template, {}, 2)).toEqual('<span title="Hello">Greetings</span>');

      function Template(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          elementStart(0, 'span', ['title', 'Hello']);
          { text(1, 'Greetings'); }
          elementEnd();
        }
      }
      expect(ngDevMode).toHaveProperties({
        firstTemplatePass: 1,
        tNode: 3,  // 1 for div, 1 for text, 1 for host element
        tView: 2,  // 1 for root view, 1 for template
        rendererCreateElement: 1,
      });
    });

    it('should render and update basic "Hello, World" template', () => {
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          elementStart(0, 'h1');
          { text(1); }
          elementEnd();
        }
        if (rf & RenderFlags.Update) {
          textBinding(1, interpolation1('Hello, ', ctx.name, '!'));
        }
      }, 2, 1);

      const fixture = new ComponentFixture(App);
      fixture.component.name = 'World';
      fixture.update();
      expect(fixture.html).toEqual('<h1>Hello, World!</h1>');

      fixture.component.name = 'New World';
      fixture.update();
      expect(fixture.html).toEqual('<h1>Hello, New World!</h1>');
    });
  });

  describe('text bindings', () => {
    it('should render "undefined" as "" when used with `bind()`', () => {
      function Template(rf: RenderFlags, name: string) {
        if (rf & RenderFlags.Create) {
          text(0);
        }
        if (rf & RenderFlags.Update) {
          textBinding(0, bind(name));
        }
      }

      expect(renderToHtml(Template, 'benoit', 1, 1)).toEqual('benoit');
      expect(renderToHtml(Template, undefined, 1, 1)).toEqual('');
      expect(ngDevMode).toHaveProperties({
        firstTemplatePass: 0,
        tNode: 2,
        tView: 2,  // 1 for root view, 1 for template
        rendererSetText: 2,
      });
    });

    it('should render "null" as "" when used with `bind()`', () => {
      function Template(rf: RenderFlags, name: string) {
        if (rf & RenderFlags.Create) {
          text(0);
        }
        if (rf & RenderFlags.Update) {
          textBinding(0, bind(name));
        }
      }

      expect(renderToHtml(Template, 'benoit', 1, 1)).toEqual('benoit');
      expect(renderToHtml(Template, null, 1, 1)).toEqual('');
      expect(ngDevMode).toHaveProperties({
        firstTemplatePass: 0,
        tNode: 2,
        tView: 2,  // 1 for root view, 1 for template
        rendererSetText: 2,
      });
    });

    it('should support creation-time values in text nodes', () => {
      function Template(rf: RenderFlags, value: string) {
        if (rf & RenderFlags.Create) {
          text(0);
          textBinding(0, value);
        }
      }
      expect(renderToHtml(Template, 'once', 1, 1)).toEqual('once');
      expect(renderToHtml(Template, 'twice', 1, 1)).toEqual('once');
      expect(ngDevMode).toHaveProperties({
        firstTemplatePass: 0,
        tNode: 2,
        tView: 2,  // 1 for root view, 1 for template
        rendererSetText: 1,
      });
    });

  });


  describe('ngNonBindable handling', () => {
    it('should keep local ref for host element', () => {
      /**
       * <b ngNonBindable #myRef id="my-id">
       *   <i>Hello {{ name }}!</i>
       * </b>
       * {{ myRef.id }}
       */
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          elementStart(0, 'b', ['id', 'my-id'], ['myRef', '']);
          disableBindings();
          elementStart(2, 'i');
          text(3, 'Hello {{ name }}!');
          elementEnd();
          enableBindings();
          elementEnd();
          text(4);
        }
        if (rf & RenderFlags.Update) {
          const ref = reference(1) as any;
          textBinding(4, interpolation1(' ', ref.id, ' '));
        }
      }, 5, 1);

      const fixture = new ComponentFixture(App);
      expect(fixture.html).toEqual('<b id="my-id"><i>Hello {{ name }}!</i></b> my-id ');
    });

    it('should invoke directives for host element', () => {
      let directiveInvoked: boolean = false;

      class TestDirective {
        ngOnInit() { directiveInvoked = true; }

        static ngDirectiveDef = defineDirective({
          type: TestDirective,
          selectors: [['', 'directive', '']],
          factory: () => new TestDirective()
        });
      }

      /**
       * <b ngNonBindable directive>
       *   <i>Hello {{ name }}!</i>
       * </b>
       */
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          elementStart(0, 'b', ['directive', '']);
          disableBindings();
          elementStart(1, 'i');
          text(2, 'Hello {{ name }}!');
          elementEnd();
          enableBindings();
          elementEnd();
        }
      }, 3, 0, [TestDirective]);

      const fixture = new ComponentFixture(App);
      expect(fixture.html).toEqual('<b directive=""><i>Hello {{ name }}!</i></b>');
      expect(directiveInvoked).toEqual(true);
    });

    it('should not invoke directives for nested elements', () => {
      let directiveInvoked: boolean = false;

      class TestDirective {
        ngOnInit() { directiveInvoked = true; }

        static ngDirectiveDef = defineDirective({
          type: TestDirective,
          selectors: [['', 'directive', '']],
          factory: () => new TestDirective()
        });
      }

      /**
       * <b ngNonBindable>
       *   <i directive>Hello {{ name }}!</i>
       * </b>
       */
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          elementStart(0, 'b');
          disableBindings();
          elementStart(1, 'i', ['directive', '']);
          text(2, 'Hello {{ name }}!');
          elementEnd();
          enableBindings();
          elementEnd();
        }
      }, 3, 0, [TestDirective]);

      const fixture = new ComponentFixture(App);
      expect(fixture.html).toEqual('<b><i directive="">Hello {{ name }}!</i></b>');
      expect(directiveInvoked).toEqual(false);
    });
  });

  describe('Siblings update', () => {
    it('should handle a flat list of static/bound text nodes', () => {
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          text(0, 'Hello ');
          text(1);
          text(2, '!');
        }
        if (rf & RenderFlags.Update) {
          textBinding(1, bind(ctx.name));
        }
      }, 3, 1);

      const fixture = new ComponentFixture(App);
      fixture.component.name = 'world';
      fixture.update();
      expect(fixture.html).toEqual('Hello world!');

      fixture.component.name = 'monde';
      fixture.update();
      expect(fixture.html).toEqual('Hello monde!');
    });

    it('should handle a list of static/bound text nodes as element children', () => {
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          elementStart(0, 'b');
          {
            text(1, 'Hello ');
            text(2);
            text(3, '!');
          }
          elementEnd();
        }
        if (rf & RenderFlags.Update) {
          textBinding(2, bind(ctx.name));
        }
      }, 4, 1);

      const fixture = new ComponentFixture(App);
      fixture.component.name = 'world';
      fixture.update();
      expect(fixture.html).toEqual('<b>Hello world!</b>');

      fixture.component.name = 'mundo';
      fixture.update();
      expect(fixture.html).toEqual('<b>Hello mundo!</b>');
    });

    it('should render/update text node as a child of a deep list of elements', () => {
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          elementStart(0, 'b');
          {
            elementStart(1, 'b');
            {
              elementStart(2, 'b');
              {
                elementStart(3, 'b');
                { text(4); }
                elementEnd();
              }
              elementEnd();
            }
            elementEnd();
          }
          elementEnd();
        }
        if (rf & RenderFlags.Update) {
          textBinding(4, interpolation1('Hello ', ctx.name, '!'));
        }
      }, 5, 1);

      const fixture = new ComponentFixture(App);
      fixture.component.name = 'world';
      fixture.update();
      expect(fixture.html).toEqual('<b><b><b><b>Hello world!</b></b></b></b>');

      fixture.component.name = 'mundo';
      fixture.update();
      expect(fixture.html).toEqual('<b><b><b><b>Hello mundo!</b></b></b></b>');
    });

    it('should update 2 sibling elements', () => {
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          elementStart(0, 'b');
          {
            element(1, 'span');
            elementStart(2, 'span', ['class', 'foo']);
            {}
            elementEnd();
          }
          elementEnd();
        }
        if (rf & RenderFlags.Update) {
          elementAttribute(2, 'id', bind(ctx.id));
        }
      }, 3, 1);

      const fixture = new ComponentFixture(App);
      fixture.component.id = 'foo';
      fixture.update();
      expect(fixture.html).toEqual('<b><span></span><span class="foo" id="foo"></span></b>');

      fixture.component.id = 'bar';
      fixture.update();
      expect(fixture.html).toEqual('<b><span></span><span class="foo" id="bar"></span></b>');
    });

    it('should handle sibling text node after element with child text node', () => {
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          elementStart(0, 'p');
          { text(1, 'hello'); }
          elementEnd();
          text(2, 'world');
        }
      }, 3);

      const fixture = new ComponentFixture(App);
      expect(fixture.html).toEqual('<p>hello</p>world');
    });
  });

  describe('basic components', () => {

    class TodoComponent {
      value = ' one';

      static ngComponentDef = defineComponent({
        type: TodoComponent,
        selectors: [['todo']],
        consts: 3,
        vars: 1,
        template: function TodoTemplate(rf: RenderFlags, ctx: any) {
          if (rf & RenderFlags.Create) {
            elementStart(0, 'p');
            {
              text(1, 'Todo');
              text(2);
            }
            elementEnd();
          }
          if (rf & RenderFlags.Update) {
            textBinding(2, bind(ctx.value));
          }
        },
        factory: () => new TodoComponent
      });
    }

    const defs = [TodoComponent];

    it('should support a basic component template', () => {
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          element(0, 'todo');
        }
      }, 1, 0, defs);

      const fixture = new ComponentFixture(App);
      expect(fixture.html).toEqual('<todo><p>Todo one</p></todo>');
    });

    it('should support a component template with sibling', () => {
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          element(0, 'todo');
          text(1, 'two');
        }
      }, 2, 0, defs);

      const fixture = new ComponentFixture(App);
      expect(fixture.html).toEqual('<todo><p>Todo one</p></todo>two');
    });

    it('should support a component template with component sibling', () => {
      /**
       * <todo></todo>
       * <todo></todo>
       */
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          element(0, 'todo');
          element(1, 'todo');
        }
      }, 2, 0, defs);

      const fixture = new ComponentFixture(App);
      expect(fixture.html).toEqual('<todo><p>Todo one</p></todo><todo><p>Todo one</p></todo>');
    });

    it('should support a component with binding on host element', () => {
      let cmptInstance: TodoComponentHostBinding|null;

      class TodoComponentHostBinding {
        title = 'one';
        static ngComponentDef = defineComponent({
          type: TodoComponentHostBinding,
          selectors: [['todo']],
          consts: 1,
          vars: 1,
          template: function TodoComponentHostBindingTemplate(
              rf: RenderFlags, ctx: TodoComponentHostBinding) {
            if (rf & RenderFlags.Create) {
              text(0);
            }
            if (rf & RenderFlags.Update) {
              textBinding(0, bind(ctx.title));
            }
          },
          factory: () => cmptInstance = new TodoComponentHostBinding,
          hostBindings: function(rf: RenderFlags, ctx: any, elementIndex: number): void {
            if (rf & RenderFlags.Create) {
              allocHostVars(1);
            }
            if (rf & RenderFlags.Update) {
              // host bindings
              elementProperty(elementIndex, 'title', bind(ctx.title));
            }
          }
        });
      }

      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          element(0, 'todo');
        }
      }, 1, 0, [TodoComponentHostBinding]);

      const fixture = new ComponentFixture(App);
      expect(fixture.html).toEqual('<todo title="one">one</todo>');

      cmptInstance !.title = 'two';
      fixture.update();
      expect(fixture.html).toEqual('<todo title="two">two</todo>');
    });

    it('should support root component with host attribute', () => {
      class HostAttributeComp {
        static ngComponentDef = defineComponent({
          type: HostAttributeComp,
          selectors: [['host-attr-comp']],
          factory: () => new HostAttributeComp(),
          consts: 0,
          vars: 0,
          hostBindings: function(rf, ctx, elIndex) {
            if (rf & RenderFlags.Create) {
              elementHostAttrs(['role', 'button']);
            }
          },
          template: (rf: RenderFlags, ctx: HostAttributeComp) => {},
        });
      }

      const fixture = new ComponentFixture(HostAttributeComp);
      expect(fixture.hostElement.getAttribute('role')).toEqual('button');
    });

    it('should support component with bindings in template', () => {
      /** <p> {{ name }} </p>*/
      class MyComp {
        name = 'Bess';
        static ngComponentDef = defineComponent({
          type: MyComp,
          selectors: [['comp']],
          consts: 2,
          vars: 1,
          template: function MyCompTemplate(rf: RenderFlags, ctx: any) {
            if (rf & RenderFlags.Create) {
              elementStart(0, 'p');
              { text(1); }
              elementEnd();
            }
            if (rf & RenderFlags.Update) {
              textBinding(1, bind(ctx.name));
            }
          },
          factory: () => new MyComp
        });
      }

      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          element(0, 'comp');
        }
      }, 1, 0, [MyComp]);

      const fixture = new ComponentFixture(App);
      expect(fixture.html).toEqual('<comp><p>Bess</p></comp>');
    });

    it('should support a component with sub-views', () => {
      /**
       * % if (condition) {
       *   <div>text</div>
       * % }
       */
      class MyComp {
        // TODO(issue/24571): remove '!'.
        condition !: boolean;
        static ngComponentDef = defineComponent({
          type: MyComp,
          selectors: [['comp']],
          consts: 1,
          vars: 0,
          template: function MyCompTemplate(rf: RenderFlags, ctx: any) {
            if (rf & RenderFlags.Create) {
              container(0);
            }
            if (rf & RenderFlags.Update) {
              containerRefreshStart(0);
              {
                if (ctx.condition) {
                  let rf1 = embeddedViewStart(0, 2, 0);
                  if (rf1 & RenderFlags.Create) {
                    elementStart(0, 'div');
                    { text(1, 'text'); }
                    elementEnd();
                  }
                  embeddedViewEnd();
                }
              }
              containerRefreshEnd();
            }
          },
          factory: () => new MyComp,
          inputs: {condition: 'condition'}
        });
      }

      /** <comp [condition]="condition"></comp> */
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          element(0, 'comp');
        }
        if (rf & RenderFlags.Update) {
          elementProperty(0, 'condition', bind(ctx.condition));
        }
      }, 1, 1, [MyComp]);

      const fixture = new ComponentFixture(App);
      fixture.component.condition = true;
      fixture.update();
      expect(fixture.html).toEqual('<comp><div>text</div></comp>');

      fixture.component.condition = false;
      fixture.update();
      expect(fixture.html).toEqual('<comp></comp>');
    });

  });

  describe('ng-container', () => {

    it('should insert as a child of a regular element', () => {
      /**
       * <div>before|<ng-container>Greetings<span></span></ng-container>|after</div>
       */
      function Template() {
        elementStart(0, 'div');
        {
          text(1, 'before|');
          elementContainerStart(2);
          {
            text(3, 'Greetings');
            element(4, 'span');
          }
          elementContainerEnd();
          text(5, '|after');
        }
        elementEnd();
      }

      const fixture = new TemplateFixture(Template, () => {}, 6);
      expect(fixture.html).toEqual('<div>before|Greetings<span></span>|after</div>');
    });

    it('should add and remove DOM nodes when ng-container is a child of a regular element', () => {
      /**
       * {% if (value) { %}
       * <div>
       *  <ng-container>content</ng-container>
       * </div>
       * {% } %}
       */
      const TestCmpt = createComponent('test-cmpt', function(rf: RenderFlags, ctx: {value: any}) {
        if (rf & RenderFlags.Create) {
          container(0);
        }
        if (rf & RenderFlags.Update) {
          containerRefreshStart(0);
          if (ctx.value) {
            let rf1 = embeddedViewStart(0, 3, 0);
            {
              if (rf1 & RenderFlags.Create) {
                elementStart(0, 'div');
                {
                  elementContainerStart(1);
                  { text(2, 'content'); }
                  elementContainerEnd();
                }
                elementEnd();
              }
            }
            embeddedViewEnd();
          }
          containerRefreshEnd();
        }
      }, 1);

      const fixture = new ComponentFixture(TestCmpt);
      expect(fixture.html).toEqual('');

      fixture.component.value = true;
      fixture.update();
      expect(fixture.html).toEqual('<div>content</div>');

      fixture.component.value = false;
      fixture.update();
      expect(fixture.html).toEqual('');
    });

    it('should add and remove DOM nodes when ng-container is a child of an embedded view (JS block)',
       () => {
         /**
          * {% if (value) { %}
          *  <ng-container>content</ng-container>
          * {% } %}
          */
         const TestCmpt =
             createComponent('test-cmpt', function(rf: RenderFlags, ctx: {value: any}) {
               if (rf & RenderFlags.Create) {
                 container(0);
               }
               if (rf & RenderFlags.Update) {
                 containerRefreshStart(0);
                 if (ctx.value) {
                   let rf1 = embeddedViewStart(0, 2, 0);
                   {
                     if (rf1 & RenderFlags.Create) {
                       elementContainerStart(0);
                       { text(1, 'content'); }
                       elementContainerEnd();
                     }
                   }
                   embeddedViewEnd();
                 }
                 containerRefreshEnd();
               }
             }, 1);

         const fixture = new ComponentFixture(TestCmpt);
         expect(fixture.html).toEqual('');

         fixture.component.value = true;
         fixture.update();
         expect(fixture.html).toEqual('content');

         fixture.component.value = false;
         fixture.update();
         expect(fixture.html).toEqual('');
       });

    it('should add and remove DOM nodes when ng-container is a child of an embedded view (ViewContainerRef)',
       () => {

         function ngIfTemplate(rf: RenderFlags, ctx: any) {
           if (rf & RenderFlags.Create) {
             elementContainerStart(0);
             { text(1, 'content'); }
             elementContainerEnd();
           }
         }

         /**
          * <ng-container *ngIf="value">content</ng-container>
          */
         // equivalent to:
         /**
          * <ng-template [ngIf]="value">
          *  <ng-container>
          *    content
          *  </ng-container>
          * </ng-template>
          */
         const TestCmpt =
             createComponent('test-cmpt', function(rf: RenderFlags, ctx: {value: any}) {
               if (rf & RenderFlags.Create) {
                 template(0, ngIfTemplate, 2, 0, 'ng-template', [AttributeMarker.Bindings, 'ngIf']);
               }
               if (rf & RenderFlags.Update) {
                 elementProperty(0, 'ngIf', bind(ctx.value));
               }
             }, 1, 1, [NgIf]);

         const fixture = new ComponentFixture(TestCmpt);
         expect(fixture.html).toEqual('');

         fixture.component.value = true;
         fixture.update();
         expect(fixture.html).toEqual('content');

         fixture.component.value = false;
         fixture.update();
         expect(fixture.html).toEqual('');
       });

    // https://stackblitz.com/edit/angular-tfhcz1?file=src%2Fapp%2Fapp.component.ts
    it('should add and remove DOM nodes when ng-container is a child of a delayed embedded view',
       () => {

         class TestDirective {
           constructor(private _tplRef: TemplateRef<any>, private _vcRef: ViewContainerRef) {}

           createAndInsert() { this._vcRef.insert(this._tplRef.createEmbeddedView({})); }

           clear() { this._vcRef.clear(); }

           static ngDirectiveDef = defineDirective({
             type: TestDirective,
             selectors: [['', 'testDirective', '']],
             factory:
                 () => testDirective = new TestDirective(
                     directiveInject(TemplateRef as any), directiveInject(ViewContainerRef as any)),
           });
         }


         function embeddedTemplate(rf: RenderFlags, ctx: any) {
           if (rf & RenderFlags.Create) {
             elementContainerStart(0);
             { text(1, 'content'); }
             elementContainerEnd();
           }
         }

         let testDirective: TestDirective;


         `<ng-template testDirective>
            <ng-container>
              content
            </ng-container>
          </ng-template>`;
         const TestCmpt = createComponent('test-cmpt', function(rf: RenderFlags) {
           if (rf & RenderFlags.Create) {
             template(
                 0, embeddedTemplate, 2, 0, 'ng-template',
                 [AttributeMarker.Bindings, 'testDirective']);
           }
         }, 1, 0, [TestDirective]);

         const fixture = new ComponentFixture(TestCmpt);
         expect(fixture.html).toEqual('');

         testDirective !.createAndInsert();
         fixture.update();
         expect(fixture.html).toEqual('content');

         testDirective !.clear();
         fixture.update();
         expect(fixture.html).toEqual('');
       });

    it('should render at the component view root', () => {
      /**
       * <ng-container>component template</ng-container>
       */
      const TestCmpt = createComponent('test-cmpt', function(rf: RenderFlags) {
        if (rf & RenderFlags.Create) {
          elementContainerStart(0);
          { text(1, 'component template'); }
          elementContainerEnd();
        }
      }, 2);

      function App() { element(0, 'test-cmpt'); }

      const fixture = new TemplateFixture(App, () => {}, 1, 0, [TestCmpt]);
      expect(fixture.html).toEqual('<test-cmpt>component template</test-cmpt>');
    });

    it('should render inside another ng-container', () => {
      /**
       * <ng-container>
       *   <ng-container>
       *     <ng-container>
       *       content
       *     </ng-container>
       *   </ng-container>
       * </ng-container>
       */
      const TestCmpt = createComponent('test-cmpt', function(rf: RenderFlags) {
        if (rf & RenderFlags.Create) {
          elementContainerStart(0);
          {
            elementContainerStart(1);
            {
              elementContainerStart(2);
              { text(3, 'content'); }
              elementContainerEnd();
            }
            elementContainerEnd();
          }
          elementContainerEnd();
        }
      }, 4);

      function App() { element(0, 'test-cmpt'); }

      const fixture = new TemplateFixture(App, () => {}, 1, 0, [TestCmpt]);
      expect(fixture.html).toEqual('<test-cmpt>content</test-cmpt>');
    });

    it('should render inside another ng-container at the root of a delayed view', () => {
      let testDirective: TestDirective;

      class TestDirective {
        constructor(private _tplRef: TemplateRef<any>, private _vcRef: ViewContainerRef) {}

        createAndInsert() { this._vcRef.insert(this._tplRef.createEmbeddedView({})); }

        clear() { this._vcRef.clear(); }

        static ngDirectiveDef = defineDirective({
          type: TestDirective,
          selectors: [['', 'testDirective', '']],
          factory:
              () => testDirective = new TestDirective(
                  directiveInject(TemplateRef as any), directiveInject(ViewContainerRef as any)),
        });
      }


      function embeddedTemplate(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          elementContainerStart(0);
          {
            elementContainerStart(1);
            {
              elementContainerStart(2);
              { text(3, 'content'); }
              elementContainerEnd();
            }
            elementContainerEnd();
          }
          elementContainerEnd();
        }
      }

      /**
       * <ng-template testDirective>
       *   <ng-container>
       *     <ng-container>
       *       <ng-container>
       *         content
       *       </ng-container>
       *     </ng-container>
       *   </ng-container>
       * </ng-template>
       */
      const TestCmpt = createComponent('test-cmpt', function(rf: RenderFlags) {
        if (rf & RenderFlags.Create) {
          template(
              0, embeddedTemplate, 4, 0, 'ng-template',
              [AttributeMarker.Bindings, 'testDirective']);
        }
      }, 1, 0, [TestDirective]);

      function App() { element(0, 'test-cmpt'); }

      const fixture = new ComponentFixture(TestCmpt);
      expect(fixture.html).toEqual('');

      testDirective !.createAndInsert();
      fixture.update();
      expect(fixture.html).toEqual('content');

      testDirective !.createAndInsert();
      fixture.update();
      expect(fixture.html).toEqual('contentcontent');

      testDirective !.clear();
      fixture.update();
      expect(fixture.html).toEqual('');
    });

    it('should support directives and inject ElementRef', () => {

      class Directive {
        constructor(public elRef: ElementRef) {}

        static ngDirectiveDef = defineDirective({
          type: Directive,
          selectors: [['', 'dir', '']],
          factory: () => directive = new Directive(directiveInject(ElementRef)),
        });
      }

      let directive: Directive;

      /**
       * <div><ng-container dir></ng-container></div>
       */
      function Template() {
        elementStart(0, 'div');
        {
          elementContainerStart(1, [AttributeMarker.Bindings, 'dir']);
          elementContainerEnd();
        }
        elementEnd();
      }

      const fixture = new TemplateFixture(Template, () => {}, 2, 0, [Directive]);
      expect(fixture.html).toEqual('<div></div>');
      expect(directive !.elRef.nativeElement.nodeType).toBe(Node.COMMENT_NODE);
    });

    it('should support ViewContainerRef when ng-container is at the root of a view', () => {

      function ContentTemplate(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          text(0, 'Content');
        }
      }

      class Directive {
        contentTpl: TemplateRef<{}>|null = null;

        constructor(private _vcRef: ViewContainerRef) {}

        insertView() { this._vcRef.createEmbeddedView(this.contentTpl as TemplateRef<{}>); }

        clear() { this._vcRef.clear(); }

        static ngDirectiveDef = defineDirective({
          type: Directive,
          selectors: [['', 'dir', '']],
          factory: () => directive = new Directive(directiveInject(ViewContainerRef as any)),
          inputs: {contentTpl: 'contentTpl'},
        });
      }

      let directive: Directive;

      /**
       * <ng-container dir [contentTpl]="content">
       *    <ng-template #content>Content</ng-template>
       * </ng-container>
       */
      const App = createComponent('app', function(rf: RenderFlags) {
        if (rf & RenderFlags.Create) {
          elementContainerStart(0, [AttributeMarker.Bindings, 'dir']);
          template(
              1, ContentTemplate, 1, 0, 'ng-template', null, ['content', ''], templateRefExtractor);
          elementContainerEnd();
        }
        if (rf & RenderFlags.Update) {
          const content = reference(2) as any;
          elementProperty(0, 'contentTpl', bind(content));
        }
      }, 3, 1, [Directive]);


      const fixture = new ComponentFixture(App);
      expect(fixture.html).toEqual('');

      directive !.insertView();
      fixture.update();
      expect(fixture.html).toEqual('Content');

      directive !.clear();
      fixture.update();
      expect(fixture.html).toEqual('');
    });

    it('should support ViewContainerRef on <ng-template> inside <ng-container>', () => {
      function ContentTemplate(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          text(0, 'Content');
        }
      }

      class Directive {
        constructor(private _tplRef: TemplateRef<{}>, private _vcRef: ViewContainerRef) {}

        insertView() { this._vcRef.createEmbeddedView(this._tplRef); }

        clear() { this._vcRef.clear(); }

        static ngDirectiveDef = defineDirective({
          type: Directive,
          selectors: [['', 'dir', '']],
          factory:
              () => directive = new Directive(
                  directiveInject(TemplateRef as any), directiveInject(ViewContainerRef as any)),
        });
      }

      let directive: Directive;

      /**
       * <ng-container>
       *    <ng-template dir>Content</ng-template>
       * </ng-container>
       */
      const App = createComponent('app', function(rf: RenderFlags) {
        if (rf & RenderFlags.Create) {
          elementContainerStart(0);
          template(
              1, ContentTemplate, 1, 0, 'ng-template', [AttributeMarker.Bindings, 'dir'], [],
              templateRefExtractor);
          elementContainerEnd();
        }
      }, 2, 0, [Directive]);


      const fixture = new ComponentFixture(App);
      expect(fixture.html).toEqual('');

      directive !.insertView();
      fixture.update();
      expect(fixture.html).toEqual('Content');

      directive !.clear();
      fixture.update();
      expect(fixture.html).toEqual('');
    });

    it('should not set any attributes', () => {
      /**
       * <div><ng-container id="foo"></ng-container></div>
       */
      function Template() {
        elementStart(0, 'div');
        {
          elementContainerStart(1, ['id', 'foo']);
          elementContainerEnd();
        }
        elementEnd();
      }

      const fixture = new TemplateFixture(Template, () => {}, 2);
      expect(fixture.html).toEqual('<div></div>');
    });

  });

  describe('tree', () => {
    interface Tree {
      beforeLabel?: string;
      subTrees?: Tree[];
      afterLabel?: string;
    }

    interface ParentCtx {
      beforeTree: Tree;
      projectedTree: Tree;
      afterTree: Tree;
    }

    function showLabel(rf: RenderFlags, ctx: {label: string | undefined}) {
      if (rf & RenderFlags.Create) {
        container(0);
      }
      if (rf & RenderFlags.Update) {
        containerRefreshStart(0);
        {
          if (ctx.label != null) {
            let rf1 = embeddedViewStart(0, 1, 1);
            if (rf1 & RenderFlags.Create) {
              text(0);
            }
            if (rf1 & RenderFlags.Update) {
              textBinding(0, bind(ctx.label));
            }
            embeddedViewEnd();
          }
        }
        containerRefreshEnd();
      }
    }

    function showTree(rf: RenderFlags, ctx: {tree: Tree}) {
      if (rf & RenderFlags.Create) {
        container(0);
        container(1);
        container(2);
      }
      if (rf & RenderFlags.Update) {
        containerRefreshStart(0);
        {
          const rf0 = embeddedViewStart(0, 1, 0);
          { showLabel(rf0, {label: ctx.tree.beforeLabel}); }
          embeddedViewEnd();
        }
        containerRefreshEnd();
        containerRefreshStart(1);
        {
          for (let subTree of ctx.tree.subTrees || []) {
            const rf0 = embeddedViewStart(0, 3, 0);
            { showTree(rf0, {tree: subTree}); }
            embeddedViewEnd();
          }
        }
        containerRefreshEnd();
        containerRefreshStart(2);
        {
          const rf0 = embeddedViewStart(0, 1, 0);
          { showLabel(rf0, {label: ctx.tree.afterLabel}); }
          embeddedViewEnd();
        }
        containerRefreshEnd();
      }
    }

    class ChildComponent {
      // TODO(issue/24571): remove '!'.
      beforeTree !: Tree;
      // TODO(issue/24571): remove '!'.
      afterTree !: Tree;
      static ngComponentDef = defineComponent({
        selectors: [['child']],
        type: ChildComponent,
        consts: 3,
        vars: 0,
        template: function ChildComponentTemplate(
            rf: RenderFlags, ctx: {beforeTree: Tree, afterTree: Tree}) {
          if (rf & RenderFlags.Create) {
            projectionDef();
            container(0);
            projection(1);
            container(2);
          }
          if (rf & RenderFlags.Update) {
            containerRefreshStart(0);
            {
              const rf0 = embeddedViewStart(0, 3, 0);
              { showTree(rf0, {tree: ctx.beforeTree}); }
              embeddedViewEnd();
            }
            containerRefreshEnd();
            containerRefreshStart(2);
            {
              const rf0 = embeddedViewStart(0, 3, 0);
              { showTree(rf0, {tree: ctx.afterTree}); }
              embeddedViewEnd();
            }
            containerRefreshEnd();
          }
        },
        factory: () => new ChildComponent,
        inputs: {beforeTree: 'beforeTree', afterTree: 'afterTree'}
      });
    }

    function parentTemplate(rf: RenderFlags, ctx: ParentCtx) {
      if (rf & RenderFlags.Create) {
        elementStart(0, 'child');
        { container(1); }
        elementEnd();
      }
      if (rf & RenderFlags.Update) {
        elementProperty(0, 'beforeTree', bind(ctx.beforeTree));
        elementProperty(0, 'afterTree', bind(ctx.afterTree));
        containerRefreshStart(1);
        {
          const rf0 = embeddedViewStart(0, 3, 0);
          { showTree(rf0, {tree: ctx.projectedTree}); }
          embeddedViewEnd();
        }
        containerRefreshEnd();
      }
    }

    it('should work with a tree', () => {

      const ctx: ParentCtx = {
        beforeTree: {subTrees: [{beforeLabel: 'a'}]},
        projectedTree: {beforeLabel: 'p'},
        afterTree: {afterLabel: 'z'}
      };
      const defs = [ChildComponent];
      expect(renderToHtml(parentTemplate, ctx, 2, 2, defs)).toEqual('<child>apz</child>');
      ctx.projectedTree = {subTrees: [{}, {}, {subTrees: [{}, {}]}, {}]};
      ctx.beforeTree.subTrees !.push({afterLabel: 'b'});
      expect(renderToHtml(parentTemplate, ctx, 2, 2, defs)).toEqual('<child>abz</child>');
      ctx.projectedTree.subTrees ![1].afterLabel = 'h';
      expect(renderToHtml(parentTemplate, ctx, 2, 2, defs)).toEqual('<child>abhz</child>');
      ctx.beforeTree.subTrees !.push({beforeLabel: 'c'});
      expect(renderToHtml(parentTemplate, ctx, 2, 2, defs)).toEqual('<child>abchz</child>');

      // To check the context easily:
      // console.log(JSON.stringify(ctx));
    });

  });

  describe('element bindings', () => {

    describe('elementAttribute', () => {
      it('should support attribute bindings', () => {
        const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
          if (rf & RenderFlags.Create) {
            element(0, 'span');
          }
          if (rf & RenderFlags.Update) {
            elementAttribute(0, 'title', bind(ctx.title));
          }
        }, 1, 1);

        const fixture = new ComponentFixture(App);
        fixture.component.title = 'Hello';
        fixture.update();
        // initial binding
        expect(fixture.html).toEqual('<span title="Hello"></span>');

        // update binding
        fixture.component.title = 'Hi!';
        fixture.update();
        expect(fixture.html).toEqual('<span title="Hi!"></span>');

        // remove attribute
        fixture.component.title = null;
        fixture.update();
        expect(fixture.html).toEqual('<span></span>');
      });

      it('should stringify values used attribute bindings', () => {
        const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
          if (rf & RenderFlags.Create) {
            element(0, 'span');
          }
          if (rf & RenderFlags.Update) {
            elementAttribute(0, 'title', bind(ctx.title));
          }
        }, 1, 1);

        const fixture = new ComponentFixture(App);
        fixture.component.title = NaN;
        fixture.update();
        expect(fixture.html).toEqual('<span title="NaN"></span>');

        fixture.component.title = {toString: () => 'Custom toString'};
        fixture.update();
        expect(fixture.html).toEqual('<span title="Custom toString"></span>');
      });

      it('should update bindings', () => {
        function Template(rf: RenderFlags, c: any) {
          if (rf & RenderFlags.Create) {
            element(0, 'b');
          }
          if (rf & RenderFlags.Update) {
            elementAttribute(0, 'a', interpolationV(c));
            elementAttribute(0, 'a0', bind(c[1]));
            elementAttribute(0, 'a1', interpolation1(c[0], c[1], c[16]));
            elementAttribute(0, 'a2', interpolation2(c[0], c[1], c[2], c[3], c[16]));
            elementAttribute(0, 'a3', interpolation3(c[0], c[1], c[2], c[3], c[4], c[5], c[16]));
            elementAttribute(
                0, 'a4', interpolation4(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[16]));
            elementAttribute(
                0, 'a5',
                interpolation5(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[16]));
            elementAttribute(
                0, 'a6', interpolation6(
                             c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10],
                             c[11], c[16]));
            elementAttribute(
                0, 'a7', interpolation7(
                             c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10],
                             c[11], c[12], c[13], c[16]));
            elementAttribute(
                0, 'a8', interpolation8(
                             c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10],
                             c[11], c[12], c[13], c[14], c[15], c[16]));
          }
        }
        let args = ['(', 0, 'a', 1, 'b', 2, 'c', 3, 'd', 4, 'e', 5, 'f', 6, 'g', 7, ')'];
        expect(renderToHtml(Template, args, 1, 54))
            .toEqual(
                '<b a="(0a1b2c3d4e5f6g7)" a0="0" a1="(0)" a2="(0a1)" a3="(0a1b2)" a4="(0a1b2c3)" a5="(0a1b2c3d4)" a6="(0a1b2c3d4e5)" a7="(0a1b2c3d4e5f6)" a8="(0a1b2c3d4e5f6g7)"></b>');
        args = args.reverse();
        expect(renderToHtml(Template, args, 1, 54))
            .toEqual(
                '<b a=")7g6f5e4d3c2b1a0(" a0="7" a1=")7(" a2=")7g6(" a3=")7g6f5(" a4=")7g6f5e4(" a5=")7g6f5e4d3(" a6=")7g6f5e4d3c2(" a7=")7g6f5e4d3c2b1(" a8=")7g6f5e4d3c2b1a0("></b>');
        args = args.reverse();
        expect(renderToHtml(Template, args, 1, 54))
            .toEqual(
                '<b a="(0a1b2c3d4e5f6g7)" a0="0" a1="(0)" a2="(0a1)" a3="(0a1b2)" a4="(0a1b2c3)" a5="(0a1b2c3d4)" a6="(0a1b2c3d4e5)" a7="(0a1b2c3d4e5f6)" a8="(0a1b2c3d4e5f6g7)"></b>');
      });

      it('should not update DOM if context has not changed', () => {
        const ctx: {title: string | null} = {title: 'Hello'};

        const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
          if (rf & RenderFlags.Create) {
            elementStart(0, 'span');
            container(1);
            elementEnd();
          }
          if (rf & RenderFlags.Update) {
            elementAttribute(0, 'title', bind(ctx.title));
            containerRefreshStart(1);
            {
              if (true) {
                let rf1 = embeddedViewStart(1, 1, 1);
                {
                  if (rf1 & RenderFlags.Create) {
                    elementStart(0, 'b');
                    {}
                    elementEnd();
                  }
                  if (rf1 & RenderFlags.Update) {
                    elementAttribute(0, 'title', bind(ctx.title));
                  }
                }
                embeddedViewEnd();
              }
            }
            containerRefreshEnd();
          }
        }, 2, 1);

        const fixture = new ComponentFixture(App);
        fixture.component.title = 'Hello';
        fixture.update();
        // initial binding
        expect(fixture.html).toEqual('<span title="Hello"><b title="Hello"></b></span>');
        // update DOM manually
        fixture.hostElement.querySelector('b') !.setAttribute('title', 'Goodbye');

        // refresh with same binding
        fixture.update();
        expect(fixture.html).toEqual('<span title="Hello"><b title="Goodbye"></b></span>');

        // refresh again with same binding
        fixture.update();
        expect(fixture.html).toEqual('<span title="Hello"><b title="Goodbye"></b></span>');
      });

      it('should support host attribute bindings', () => {
        let hostBindingDir: HostBindingDir;

        class HostBindingDir {
          /* @HostBinding('attr.aria-label') */
          label = 'some label';

          static ngDirectiveDef = defineDirective({
            type: HostBindingDir,
            selectors: [['', 'hostBindingDir', '']],
            factory: function HostBindingDir_Factory() {
              return hostBindingDir = new HostBindingDir();
            },
            hostBindings: function HostBindingDir_HostBindings(
                rf: RenderFlags, ctx: any, elIndex: number) {
              if (rf & RenderFlags.Create) {
                allocHostVars(1);
              }
              if (rf & RenderFlags.Update) {
                elementAttribute(elIndex, 'aria-label', bind(ctx.label));
              }
            }
          });
        }

        const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
          if (rf & RenderFlags.Create) {
            element(0, 'div', ['hostBindingDir', '']);
          }
        }, 1, 0, [HostBindingDir]);

        const fixture = new ComponentFixture(App);
        expect(fixture.html).toEqual(`<div aria-label="some label" hostbindingdir=""></div>`);

        hostBindingDir !.label = 'other label';
        fixture.update();
        expect(fixture.html).toEqual(`<div aria-label="other label" hostbindingdir=""></div>`);
      });
    });

    describe('elementStyle', () => {
      it('should support binding to styles', () => {
        const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
          if (rf & RenderFlags.Create) {
            elementStart(0, 'span');
            elementStyling(null, ['border-color']);
            elementEnd();
          }
          if (rf & RenderFlags.Update) {
            elementStyleProp(0, 0, ctx.color);
            elementStylingApply(0);
          }
        }, 1);

        const fixture = new ComponentFixture(App);
        fixture.component.color = 'red';
        fixture.update();
        expect(fixture.html).toEqual('<span style="border-color: red;"></span>');

        fixture.component.color = 'green';
        fixture.update();
        expect(fixture.html).toEqual('<span style="border-color: green;"></span>');

        fixture.component.color = null;
        fixture.update();
        expect(fixture.html).toEqual('<span></span>');
      });

      it('should support binding to styles with suffix', () => {
        const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
          if (rf & RenderFlags.Create) {
            elementStart(0, 'span');
            elementStyling(null, ['font-size']);
            elementEnd();
          }
          if (rf & RenderFlags.Update) {
            elementStyleProp(0, 0, ctx.time, 'px');
            elementStylingApply(0);
          }
        }, 1);

        const fixture = new ComponentFixture(App);
        fixture.component.time = '100';
        fixture.update();
        expect(fixture.html).toEqual('<span style="font-size: 100px;"></span>');

        fixture.component.time = 200;
        fixture.update();
        expect(fixture.html).toEqual('<span style="font-size: 200px;"></span>');

        fixture.component.time = 0;
        fixture.update();
        expect(fixture.html).toEqual('<span style="font-size: 0px;"></span>');

        fixture.component.time = null;
        fixture.update();
        expect(fixture.html).toEqual('<span></span>');
      });
    });

    describe('class-based styling', () => {
      it('should support CSS class toggle', () => {
        /** <span [class.active]="class"></span> */
        const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
          if (rf & RenderFlags.Create) {
            elementStart(0, 'span');
            elementStyling(['active']);
            elementEnd();
          }
          if (rf & RenderFlags.Update) {
            elementClassProp(0, 0, ctx.class);
            elementStylingApply(0);
          }
        }, 1);

        const fixture = new ComponentFixture(App);
        fixture.component.class = true;
        fixture.update();
        expect(fixture.html).toEqual('<span class="active"></span>');

        fixture.component.class = false;
        fixture.update();
        expect(fixture.html).toEqual('<span class=""></span>');

        // truthy values
        fixture.component.class = 'a_string';
        fixture.update();
        expect(fixture.html).toEqual('<span class="active"></span>');

        fixture.component.class = 10;
        fixture.update();
        expect(fixture.html).toEqual('<span class="active"></span>');

        // falsy values
        fixture.component.class = '';
        fixture.update();
        expect(fixture.html).toEqual('<span class=""></span>');

        fixture.component.class = 0;
        fixture.update();
        expect(fixture.html).toEqual('<span class=""></span>');
      });

      it('should work correctly with existing static classes', () => {
        const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
          if (rf & RenderFlags.Create) {
            elementStart(0, 'span', [AttributeMarker.Classes, 'existing']);
            elementStyling(['existing', 'active']);
            elementEnd();
          }
          if (rf & RenderFlags.Update) {
            elementClassProp(0, 1, ctx.class);
            elementStylingApply(0);
          }
        }, 1);

        const fixture = new ComponentFixture(App);
        fixture.component.class = true;
        fixture.update();
        expect(fixture.html).toEqual('<span class="existing active"></span>');

        fixture.component.class = false;
        fixture.update();
        expect(fixture.html).toEqual('<span class="existing"></span>');
      });

      it('should apply classes properly when nodes are components', () => {
        const MyComp = createComponent('my-comp', (rf: RenderFlags, ctx: any) => {
          if (rf & RenderFlags.Create) {
            text(0, 'Comp Content');
          }
        }, 1, 0, []);

        /**
         * <my-comp [class.active]="class"></my-comp>
         */
        const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
          if (rf & RenderFlags.Create) {
            elementStart(0, 'my-comp');
            elementStyling(['active']);
            elementEnd();
          }
          if (rf & RenderFlags.Update) {
            elementClassProp(0, 0, ctx.class);
            elementStylingApply(0);
          }
        }, 1, 0, [MyComp]);

        const fixture = new ComponentFixture(App);
        fixture.component.class = true;
        fixture.update();
        expect(fixture.html).toEqual('<my-comp class="active">Comp Content</my-comp>');

        fixture.component.class = false;
        fixture.update();
        expect(fixture.html).toEqual('<my-comp class="">Comp Content</my-comp>');
      });

      it('should apply classes properly when nodes have LContainers', () => {
        let structuralComp !: StructuralComp;

        class StructuralComp {
          tmp !: TemplateRef<any>;

          constructor(public vcr: ViewContainerRef) {}

          create() { this.vcr.createEmbeddedView(this.tmp); }

          static ngComponentDef = defineComponent({
            type: StructuralComp,
            selectors: [['structural-comp']],
            factory: () => structuralComp =
                         new StructuralComp(directiveInject(ViewContainerRef as any)),
            inputs: {tmp: 'tmp'},
            consts: 1,
            vars: 0,
            template: (rf: RenderFlags, ctx: StructuralComp) => {
              if (rf & RenderFlags.Create) {
                text(0, 'Comp Content');
              }
            }
          });
        }

        function FooTemplate(rf: RenderFlags, ctx: any) {
          if (rf & RenderFlags.Create) {
            text(0, 'Temp Content');
          }
        }

        /**
         * <ng-template #foo>
         *     Temp Content
         * </ng-template>
         * <structural-comp [class.active]="class" [tmp]="foo"></structural-comp>
         */
        const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
          if (rf & RenderFlags.Create) {
            template(0, FooTemplate, 1, 0, 'ng-template', null, ['foo', ''], templateRefExtractor);
            elementStart(2, 'structural-comp');
            elementStyling(['active']);
            elementEnd();
          }
          if (rf & RenderFlags.Update) {
            const foo = reference(1) as any;
            elementClassProp(2, 0, ctx.class);
            elementStylingApply(2);
            elementProperty(2, 'tmp', bind(foo));
          }
        }, 3, 1, [StructuralComp]);

        const fixture = new ComponentFixture(App);
        fixture.component.class = true;
        fixture.update();
        expect(fixture.html)
            .toEqual('<structural-comp class="active">Comp Content</structural-comp>');

        structuralComp.create();
        fixture.update();
        expect(fixture.html)
            .toEqual('<structural-comp class="active">Comp Content</structural-comp>Temp Content');

        fixture.component.class = false;
        fixture.update();
        expect(fixture.html)
            .toEqual('<structural-comp class="">Comp Content</structural-comp>Temp Content');
      });

      let mockClassDirective: DirWithClassDirective;
      class DirWithClassDirective {
        static ngDirectiveDef = defineDirective({
          type: DirWithClassDirective,
          selectors: [['', 'DirWithClass', '']],
          factory: () => mockClassDirective = new DirWithClassDirective(),
          inputs: {'klass': 'class'}
        });

        public classesVal: string = '';
        set klass(value: string) { this.classesVal = value; }
      }

      let mockStyleDirective: DirWithStyleDirective;
      class DirWithStyleDirective {
        static ngDirectiveDef = defineDirective({
          type: DirWithStyleDirective,
          selectors: [['', 'DirWithStyle', '']],
          factory: () => mockStyleDirective = new DirWithStyleDirective(),
          inputs: {'style': 'style'}
        });

        public stylesVal: string = '';
        set style(value: string) { this.stylesVal = value; }
      }

      it('should delegate initial classes to a [class] input binding if present on a directive on the same element',
         () => {
           /**
            * <div class="apple orange banana" DirWithClass></div>
            */
           const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
             if (rf & RenderFlags.Create) {
               elementStart(
                   0, 'div',
                   ['DirWithClass', '', AttributeMarker.Classes, 'apple', 'orange', 'banana']);
               elementStyling();
               elementEnd();
             }
             if (rf & RenderFlags.Update) {
               elementStylingApply(0);
             }
           }, 1, 0, [DirWithClassDirective]);

           const fixture = new ComponentFixture(App);
           expect(mockClassDirective !.classesVal).toEqual('apple orange banana');
         });

      it('should delegate initial styles to a [style] input binding if present on a directive on the same element',
         () => {
           /**
            * <div width="width:100px; height:200px;" DirWithStyle></div>
            */
           const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
             if (rf & RenderFlags.Create) {
               elementStart(0, 'div', [
                 'DirWithStyle', '', AttributeMarker.Styles, 'width', '100px', 'height', '200px'
               ]);
               elementStyling();
               elementEnd();
             }
             if (rf & RenderFlags.Update) {
               elementStylingApply(0);
             }
           }, 1, 0, [DirWithStyleDirective]);

           const fixture = new ComponentFixture(App);
           expect(mockStyleDirective !.stylesVal).toEqual('width:100px;height:200px');
         });

      it('should update `[class]` and bindings in the provided directive if the input is matched',
         () => {
           /**
            * <div DirWithClass></div>
           */
           const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
             if (rf & RenderFlags.Create) {
               elementStart(0, 'div', ['DirWithClass']);
               elementStyling();
               elementEnd();
             }
             if (rf & RenderFlags.Update) {
               elementStylingMap(0, 'cucumber grape');
               elementStylingApply(0);
             }
           }, 1, 0, [DirWithClassDirective]);

           const fixture = new ComponentFixture(App);
           expect(mockClassDirective !.classesVal).toEqual('cucumber grape');
         });

      it('should update `[style]` and bindings in the provided directive if the input is matched',
         () => {
           /**
            * <div DirWithStyle></div>
           */
           const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
             if (rf & RenderFlags.Create) {
               elementStart(0, 'div', ['DirWithStyle']);
               elementStyling();
               elementEnd();
             }
             if (rf & RenderFlags.Update) {
               elementStylingMap(0, null, {width: '200px', height: '500px'});
               elementStylingApply(0);
             }
           }, 1, 0, [DirWithStyleDirective]);

           const fixture = new ComponentFixture(App);
           expect(mockStyleDirective !.stylesVal).toEqual('width:200px;height:500px');
         });

      it('should apply initial styling to the element that contains the directive with host styling',
         () => {
           class DirWithInitialStyling {
             static ngDirectiveDef = defineDirective({
               type: DirWithInitialStyling,
               selectors: [['', 'DirWithInitialStyling', '']],
               factory: () => new DirWithInitialStyling(),
               hostBindings: function(
                   rf: RenderFlags, ctx: DirWithInitialStyling, elementIndex: number) {
                 if (rf & RenderFlags.Create) {
                   elementHostAttrs([
                     'title', 'foo', AttributeMarker.Classes, 'heavy', 'golden',
                     AttributeMarker.Styles, 'color', 'purple', 'font-weight', 'bold'
                   ]);
                 }
               }
             });

             public classesVal: string = '';
           }

           /**
            * <div DirWithInitialStyling
            *   class="big"
            *   style="color:black; font-size:200px"></div>
           */
           const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
             if (rf & RenderFlags.Create) {
               element(0, 'div', [
                 'DirWithInitialStyling', '', AttributeMarker.Classes, 'big',
                 AttributeMarker.Styles, 'color', 'black', 'font-size', '200px'
               ]);
             }
           }, 1, 0, [DirWithInitialStyling]);

           const fixture = new ComponentFixture(App);
           const target = fixture.hostElement.querySelector('div') !;
           const classes = target.getAttribute('class') !.split(/\s+/).sort();
           expect(classes).toEqual(['big', 'golden', 'heavy']);

           expect(target.getAttribute('title')).toEqual('foo');
           expect(target.style.getPropertyValue('color')).toEqual('black');
           expect(target.style.getPropertyValue('font-size')).toEqual('200px');
           expect(target.style.getPropertyValue('font-weight')).toEqual('bold');
         });

      it('should apply single styling bindings present within a directive onto the same element and defer the element\'s initial styling values when missing',
         () => {
           let dirInstance: DirWithSingleStylingBindings;
           /**
            * <DirWithInitialStyling class="def" [class.xyz] style="width:555px;" [style.width]
            * [style.height]></my-comp>
           */
           class DirWithSingleStylingBindings {
             static ngDirectiveDef = defineDirective({
               type: DirWithSingleStylingBindings,
               selectors: [['', 'DirWithSingleStylingBindings', '']],
               factory: () => dirInstance = new DirWithSingleStylingBindings(),
               hostBindings: function(
                   rf: RenderFlags, ctx: DirWithSingleStylingBindings, elementIndex: number) {
                 if (rf & RenderFlags.Create) {
                   elementHostAttrs(
                       [AttributeMarker.Classes, 'def', AttributeMarker.Styles, 'width', '555px']);
                   elementHostStyling(['xyz'], ['width', 'height']);
                 }
                 if (rf & RenderFlags.Update) {
                   elementHostStyleProp(0, ctx.width);
                   elementHostStyleProp(1, ctx.height);
                   elementHostClassProp(0, ctx.activateXYZClass);
                   elementHostStylingApply();
                 }
               }
             });

             width: null|string = null;
             height: null|string = null;
             activateXYZClass: boolean = false;
           }

           /**
            * <div DirWithInitialStyling class="abc" style="width:100px;
            * height:200px"></div>
           */
           const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
             if (rf & RenderFlags.Create) {
               element(0, 'div', [
                 'DirWithSingleStylingBindings', '', AttributeMarker.Classes, 'abc',
                 AttributeMarker.Styles, 'width', '100px', 'height', '200px'
               ]);
             }
           }, 1, 0, [DirWithSingleStylingBindings]);

           const fixture = new ComponentFixture(App);
           const target = fixture.hostElement.querySelector('div') !;
           expect(target.style.getPropertyValue('width')).toEqual('100px');
           expect(target.style.getPropertyValue('height')).toEqual('200px');
           expect(target.classList.contains('abc')).toBeTruthy();
           expect(target.classList.contains('def')).toBeTruthy();
           expect(target.classList.contains('xyz')).toBeFalsy();

           dirInstance !.width = '444px';
           dirInstance !.height = '999px';
           dirInstance !.activateXYZClass = true;
           fixture.update();

           expect(target.style.getPropertyValue('width')).toEqual('444px');
           expect(target.style.getPropertyValue('height')).toEqual('999px');
           expect(target.classList.contains('abc')).toBeTruthy();
           expect(target.classList.contains('def')).toBeTruthy();
           expect(target.classList.contains('xyz')).toBeTruthy();

           dirInstance !.width = null;
           dirInstance !.height = null;
           fixture.update();

           expect(target.style.getPropertyValue('width')).toEqual('100px');
           expect(target.style.getPropertyValue('height')).toEqual('200px');
           expect(target.classList.contains('abc')).toBeTruthy();
           expect(target.classList.contains('def')).toBeTruthy();
           expect(target.classList.contains('xyz')).toBeTruthy();
         });

      it('should properly prioritize single style binding collisions when they exist on multiple directives',
         () => {
           let dir1Instance: Dir1WithStyle;
           /**
            * Directive with host props:
            *   [style.width]
           */
           class Dir1WithStyle {
             static ngDirectiveDef = defineDirective({
               type: Dir1WithStyle,
               selectors: [['', 'Dir1WithStyle', '']],
               factory: () => dir1Instance = new Dir1WithStyle(),
               hostBindings: function(rf: RenderFlags, ctx: Dir1WithStyle, elementIndex: number) {
                 if (rf & RenderFlags.Create) {
                   elementHostStyling(null, ['width']);
                 }
                 if (rf & RenderFlags.Update) {
                   elementHostStyleProp(0, ctx.width);
                   elementHostStylingApply();
                 }
               }
             });
             width: null|string = null;
           }

           let dir2Instance: Dir2WithStyle;
           /**
            * Directive with host props:
            *   [style.width]
            *   style="width:111px"
           */
           class Dir2WithStyle {
             static ngDirectiveDef = defineDirective({
               type: Dir2WithStyle,
               selectors: [['', 'Dir2WithStyle', '']],
               factory: () => dir2Instance = new Dir2WithStyle(),
               hostBindings: function(rf: RenderFlags, ctx: Dir2WithStyle, elementIndex: number) {
                 if (rf & RenderFlags.Create) {
                   elementHostAttrs([AttributeMarker.Styles, 'width', '111px']);
                   elementHostStyling(null, ['width']);
                 }
                 if (rf & RenderFlags.Update) {
                   elementHostStyleProp(0, ctx.width);
                   elementHostStylingApply();
                 }
               }
             });
             width: null|string = null;
           }

           /**
            * Component with the following template:
            *   <div Dir1WithStyle Dir2WithStyle [style.width]></div>
           */
           const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
             if (rf & RenderFlags.Create) {
               element(0, 'div', ['Dir1WithStyle', '', 'Dir2WithStyle', '']);
               elementStyling(null, ['width']);
             }
             if (rf & RenderFlags.Update) {
               elementStyleProp(0, 0, ctx.width);
               elementStylingApply(0);
             }
           }, 1, 0, [Dir1WithStyle, Dir2WithStyle]);

           const fixture = new ComponentFixture(App);
           const target = fixture.hostElement.querySelector('div') !;
           expect(target.style.getPropertyValue('width')).toEqual('111px');

           fixture.component.width = '999px';
           dir1Instance !.width = '222px';
           dir2Instance !.width = '333px';
           fixture.update();
           expect(target.style.getPropertyValue('width')).toEqual('999px');

           fixture.component.width = null;
           fixture.update();
           expect(target.style.getPropertyValue('width')).toEqual('222px');

           dir1Instance !.width = null;
           fixture.update();
           expect(target.style.getPropertyValue('width')).toEqual('333px');

           dir2Instance !.width = null;
           fixture.update();
           expect(target.style.getPropertyValue('width')).toEqual('111px');

           dir1Instance !.width = '666px';
           fixture.update();
           expect(target.style.getPropertyValue('width')).toEqual('666px');

           fixture.component.width = '777px';
           fixture.update();
           expect(target.style.getPropertyValue('width')).toEqual('777px');
         });

      it('should properly prioritize multi style binding collisions when they exist on multiple directives',
         () => {
           let dir1Instance: Dir1WithStyling;
           /**
            * Directive with host props:
            *   [style]
            *   [class]
           */
           class Dir1WithStyling {
             static ngDirectiveDef = defineDirective({
               type: Dir1WithStyling,
               selectors: [['', 'Dir1WithStyling', '']],
               factory: () => dir1Instance = new Dir1WithStyling(),
               hostBindings: function(rf: RenderFlags, ctx: Dir1WithStyling, elementIndex: number) {
                 if (rf & RenderFlags.Create) {
                   elementHostStyling();
                 }
                 if (rf & RenderFlags.Update) {
                   elementHostStylingMap(ctx.classesExp, ctx.stylesExp);
                   elementHostStylingApply();
                 }
               }
             });

             classesExp: any = {};
             stylesExp: any = {};
           }

           let dir2Instance: Dir2WithStyling;
           /**
            * Directive with host props:
            *   [style]
            *   style="width:111px"
           */
           class Dir2WithStyling {
             static ngDirectiveDef = defineDirective({
               type: Dir2WithStyling,
               selectors: [['', 'Dir2WithStyling', '']],
               factory: () => dir2Instance = new Dir2WithStyling(),
               hostBindings: function(rf: RenderFlags, ctx: Dir2WithStyling, elementIndex: number) {
                 if (rf & RenderFlags.Create) {
                   elementHostAttrs([AttributeMarker.Styles, 'width', '111px']);
                   elementHostStyling();
                 }
                 if (rf & RenderFlags.Update) {
                   elementHostStylingMap(null, ctx.stylesExp);
                   elementHostStylingApply();
                 }
               }
             });

             stylesExp: any = {};
           }

           /**
            * Component with the following template:
            *   <div Dir1WithStyling Dir2WithStyling [style] [class]></div>
           */
           const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
             if (rf & RenderFlags.Create) {
               element(0, 'div', ['Dir1WithStyling', '', 'Dir2WithStyling', '']);
               elementStyling();
             }
             if (rf & RenderFlags.Update) {
               elementStylingMap(0, ctx.classesExp, ctx.stylesExp);
               elementStylingApply(0);
             }
           }, 1, 0, [Dir1WithStyling, Dir2WithStyling]);

           const fixture = new ComponentFixture(App);
           const target = fixture.hostElement.querySelector('div') !;
           expect(target.style.getPropertyValue('width')).toEqual('111px');

           const compInstance = fixture.component;
           compInstance.stylesExp = {width: '999px', height: null};
           compInstance.classesExp = {one: true, two: false};
           dir1Instance !.stylesExp = {width: '222px'};
           dir1Instance !.classesExp = {two: true, three: false};
           dir2Instance !.stylesExp = {width: '333px', height: '100px'};
           fixture.update();
           expect(target.style.getPropertyValue('width')).toEqual('999px');
           expect(target.style.getPropertyValue('height')).toEqual('100px');
           expect(target.classList.contains('one')).toBeTruthy();
           expect(target.classList.contains('two')).toBeFalsy();
           expect(target.classList.contains('three')).toBeFalsy();

           compInstance.stylesExp = {};
           compInstance !.classesExp = {};
           dir1Instance !.stylesExp = {width: '222px', height: '200px'};
           fixture.update();
           expect(target.style.getPropertyValue('width')).toEqual('222px');
           expect(target.style.getPropertyValue('height')).toEqual('200px');
           expect(target.classList.contains('one')).toBeFalsy();
           expect(target.classList.contains('two')).toBeTruthy();
           expect(target.classList.contains('three')).toBeFalsy();

           dir1Instance !.stylesExp = {};
           dir1Instance !.classesExp = {};
           fixture.update();
           expect(target.style.getPropertyValue('width')).toEqual('333px');
           expect(target.style.getPropertyValue('height')).toEqual('100px');
           expect(target.classList.contains('one')).toBeFalsy();
           expect(target.classList.contains('two')).toBeFalsy();
           expect(target.classList.contains('three')).toBeFalsy();

           dir2Instance !.stylesExp = {};
           compInstance.stylesExp = {height: '900px'};
           fixture.update();
           expect(target.style.getPropertyValue('width')).toEqual('111px');
           expect(target.style.getPropertyValue('height')).toEqual('900px');

           dir1Instance !.stylesExp = {width: '666px', height: '600px'};
           dir1Instance !.classesExp = {four: true, one: true};
           fixture.update();
           expect(target.style.getPropertyValue('width')).toEqual('666px');
           expect(target.style.getPropertyValue('height')).toEqual('900px');
           expect(target.classList.contains('one')).toBeTruthy();
           expect(target.classList.contains('two')).toBeFalsy();
           expect(target.classList.contains('three')).toBeFalsy();
           expect(target.classList.contains('four')).toBeTruthy();

           compInstance.stylesExp = {width: '777px'};
           compInstance.classesExp = {four: false};
           fixture.update();
           expect(target.style.getPropertyValue('width')).toEqual('777px');
           expect(target.style.getPropertyValue('height')).toEqual('600px');
           expect(target.classList.contains('one')).toBeTruthy();
           expect(target.classList.contains('two')).toBeFalsy();
           expect(target.classList.contains('three')).toBeFalsy();
           expect(target.classList.contains('four')).toBeFalsy();
         });
    });

    it('should properly handle and render interpolation for class attribute bindings', () => {
      const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          elementStart(0, 'div');
          elementStyling();
          elementEnd();
        }
        if (rf & RenderFlags.Update) {
          elementStylingMap(0, interpolation2('-', ctx.name, '-', ctx.age, '-'));
          elementStylingApply(0);
        }
      }, 1, 2);

      const fixture = new ComponentFixture(App);
      const target = fixture.hostElement.querySelector('div') !;
      expect(target.classList.contains('-fred-36-')).toBeFalsy();

      fixture.component.name = 'fred';
      fixture.component.age = '36';
      fixture.update();

      expect(target.classList.contains('-fred-36-')).toBeTruthy();
    });
  });
});

describe('template data', () => {

  it('should re-use template data and node data', () => {
    /**
     *  % if (condition) {
     *    <div></div>
     *  % }
     */
    function Template(rf: RenderFlags, ctx: any) {
      if (rf & RenderFlags.Create) {
        container(0);
      }
      if (rf & RenderFlags.Update) {
        containerRefreshStart(0);
        {
          if (ctx.condition) {
            let rf1 = embeddedViewStart(0, 1, 0);
            if (rf1 & RenderFlags.Create) {
              element(0, 'div');
            }
            embeddedViewEnd();
          }
        }
        containerRefreshEnd();
      }
    }

    expect((Template as any).ngPrivateData).toBeUndefined();

    renderToHtml(Template, {condition: true}, 1);

    const oldTemplateData = (Template as any).ngPrivateData;
    const oldContainerData = (oldTemplateData as any).data[HEADER_OFFSET];
    const oldElementData = oldContainerData.tViews[0][HEADER_OFFSET];
    expect(oldContainerData).not.toBeNull();
    expect(oldElementData).not.toBeNull();

    renderToHtml(Template, {condition: false}, 1);
    renderToHtml(Template, {condition: true}, 1);

    const newTemplateData = (Template as any).ngPrivateData;
    const newContainerData = (oldTemplateData as any).data[HEADER_OFFSET];
    const newElementData = oldContainerData.tViews[0][HEADER_OFFSET];
    expect(newTemplateData === oldTemplateData).toBe(true);
    expect(newContainerData === oldContainerData).toBe(true);
    expect(newElementData === oldElementData).toBe(true);
  });

});

describe('component styles', () => {
  it('should pass in the component styles directly into the underlying renderer', () => {
    class StyledComp {
      static ngComponentDef = defineComponent({
        type: StyledComp,
        styles: ['div { color: red; }'],
        consts: 1,
        vars: 0,
        encapsulation: 100,
        selectors: [['foo']],
        factory: () => new StyledComp(),
        template: (rf: RenderFlags, ctx: StyledComp) => {
          if (rf & RenderFlags.Create) {
            element(0, 'div');
          }
        }
      });
    }
    const rendererFactory = new ProxyRenderer3Factory();
    new ComponentFixture(StyledComp, {rendererFactory});
    expect(rendererFactory.lastCapturedType !.styles).toEqual(['div { color: red; }']);
    expect(rendererFactory.lastCapturedType !.encapsulation).toEqual(100);
  });
});

describe('component animations', () => {
  it('should pass in the component styles directly into the underlying renderer', () => {
    const animA = {name: 'a'};
    const animB = {name: 'b'};

    class AnimComp {
      static ngComponentDef = defineComponent({
        type: AnimComp,
        consts: 0,
        vars: 0,
        data: {
          animation: [
            animA,
            animB,
          ],
        },
        selectors: [['foo']],
        factory: () => new AnimComp(),
        template: (rf: RenderFlags, ctx: AnimComp) => {}
      });
    }
    const rendererFactory = new ProxyRenderer3Factory();
    new ComponentFixture(AnimComp, {rendererFactory});

    const capturedAnimations = rendererFactory.lastCapturedType !.data !['animation'];
    expect(Array.isArray(capturedAnimations)).toBeTruthy();
    expect(capturedAnimations.length).toEqual(2);
    expect(capturedAnimations).toContain(animA);
    expect(capturedAnimations).toContain(animB);
  });

  it('should include animations in the renderType data array even if the array is empty', () => {
    class AnimComp {
      static ngComponentDef = defineComponent({
        type: AnimComp,
        consts: 0,
        vars: 0,
        data: {
          animation: [],
        },
        selectors: [['foo']],
        factory: () => new AnimComp(),
        template: (rf: RenderFlags, ctx: AnimComp) => {}
      });
    }
    const rendererFactory = new ProxyRenderer3Factory();
    new ComponentFixture(AnimComp, {rendererFactory});
    const data = rendererFactory.lastCapturedType !.data;
    expect(data.animation).toEqual([]);
  });

  it('should allow [@trigger] bindings to be picked up by the underlying renderer', () => {
    class AnimComp {
      static ngComponentDef = defineComponent({
        type: AnimComp,
        consts: 1,
        vars: 1,
        selectors: [['foo']],
        factory: () => new AnimComp(),
        template: (rf: RenderFlags, ctx: AnimComp) => {
          if (rf & RenderFlags.Create) {
            element(0, 'div', [AttributeMarker.Bindings, '@fooAnimation']);
          }
          if (rf & RenderFlags.Update) {
            elementAttribute(0, '@fooAnimation', bind(ctx.animationValue));
          }
        }
      });

      animationValue = '123';
    }

    const rendererFactory = new MockRendererFactory(['setAttribute']);
    const fixture = new ComponentFixture(AnimComp, {rendererFactory});

    const renderer = rendererFactory.lastRenderer !;
    fixture.component.animationValue = '456';
    fixture.update();

    const spy = renderer.spies['setAttribute'];
    const [elm, attr, value] = spy.calls.mostRecent().args;

    expect(attr).toEqual('@fooAnimation');
    expect(value).toEqual('456');
  });

  it('should allow creation-level [@trigger] properties to be picked up by the underlying renderer',
     () => {
       class AnimComp {
         static ngComponentDef = defineComponent({
           type: AnimComp,
           consts: 1,
           vars: 1,
           selectors: [['foo']],
           factory: () => new AnimComp(),
           template: (rf: RenderFlags, ctx: AnimComp) => {
             if (rf & RenderFlags.Create) {
               element(0, 'div', ['@fooAnimation', '']);
             }
           }
         });
       }

       const rendererFactory = new MockRendererFactory(['setProperty']);
       const fixture = new ComponentFixture(AnimComp, {rendererFactory});

       const renderer = rendererFactory.lastRenderer !;
       fixture.update();

       const spy = renderer.spies['setProperty'];
       const [elm, attr, value] = spy.calls.mostRecent().args;
       expect(attr).toEqual('@fooAnimation');
     });

  it('should allow host binding animations to be picked up and rendered', () => {
    class ChildCompWithAnim {
      static ngDirectiveDef = defineDirective({
        type: ChildCompWithAnim,
        factory: () => new ChildCompWithAnim(),
        selectors: [['child-comp-with-anim']],
        hostBindings: function(rf: RenderFlags, ctx: any, elementIndex: number): void {
          if (rf & RenderFlags.Update) {
            elementProperty(0, '@fooAnim', ctx.exp);
          }
        },
      });

      exp = 'go';
    }

    class ParentComp {
      static ngComponentDef = defineComponent({
        type: ParentComp,
        consts: 1,
        vars: 1,
        selectors: [['foo']],
        factory: () => new ParentComp(),
        template: (rf: RenderFlags, ctx: ParentComp) => {
          if (rf & RenderFlags.Create) {
            element(0, 'child-comp-with-anim');
          }
        },
        directives: [ChildCompWithAnim]
      });
    }

    const rendererFactory = new MockRendererFactory(['setProperty']);
    const fixture = new ComponentFixture(ParentComp, {rendererFactory});

    const renderer = rendererFactory.lastRenderer !;
    fixture.update();

    const spy = renderer.spies['setProperty'];
    const [elm, attr, value] = spy.calls.mostRecent().args;
    expect(attr).toEqual('@fooAnim');
  });
});

describe('element discovery', () => {
  it('should only monkey-patch immediate child nodes in a component', () => {
    class StructuredComp {
      static ngComponentDef = defineComponent({
        type: StructuredComp,
        selectors: [['structured-comp']],
        factory: () => new StructuredComp(),
        consts: 2,
        vars: 0,
        template: (rf: RenderFlags, ctx: StructuredComp) => {
          if (rf & RenderFlags.Create) {
            elementStart(0, 'div');
            elementStart(1, 'p');
            elementEnd();
            elementEnd();
          }
          if (rf & RenderFlags.Update) {
          }
        }
      });
    }

    const fixture = new ComponentFixture(StructuredComp);
    fixture.update();

    const host = fixture.hostElement;
    const parent = host.querySelector('div') as any;
    const child = host.querySelector('p') as any;

    expect(parent[MONKEY_PATCH_KEY_NAME]).toBeTruthy();
    expect(child[MONKEY_PATCH_KEY_NAME]).toBeFalsy();
  });

  it('should only monkey-patch immediate child nodes in a sub component', () => {
    class ChildComp {
      static ngComponentDef = defineComponent({
        type: ChildComp,
        selectors: [['child-comp']],
        factory: () => new ChildComp(),
        consts: 3,
        vars: 0,
        template: (rf: RenderFlags, ctx: ChildComp) => {
          if (rf & RenderFlags.Create) {
            element(0, 'div');
            element(1, 'div');
            element(2, 'div');
          }
        }
      });
    }

    class ParentComp {
      static ngComponentDef = defineComponent({
        type: ParentComp,
        selectors: [['parent-comp']],
        directives: [ChildComp],
        factory: () => new ParentComp(),
        consts: 2,
        vars: 0,
        template: (rf: RenderFlags, ctx: ParentComp) => {
          if (rf & RenderFlags.Create) {
            elementStart(0, 'section');
            elementStart(1, 'child-comp');
            elementEnd();
            elementEnd();
          }
        }
      });
    }

    const fixture = new ComponentFixture(ParentComp);
    fixture.update();

    const host = fixture.hostElement;
    const child = host.querySelector('child-comp') as any;
    expect(child[MONKEY_PATCH_KEY_NAME]).toBeTruthy();

    const [kid1, kid2, kid3] = Array.from(host.querySelectorAll('child-comp > *'));
    expect(kid1[MONKEY_PATCH_KEY_NAME]).toBeTruthy();
    expect(kid2[MONKEY_PATCH_KEY_NAME]).toBeTruthy();
    expect(kid3[MONKEY_PATCH_KEY_NAME]).toBeTruthy();
  });

  it('should only monkey-patch immediate child nodes in an embedded template container', () => {
    class StructuredComp {
      static ngComponentDef = defineComponent({
        type: StructuredComp,
        selectors: [['structured-comp']],
        directives: [NgIf],
        factory: () => new StructuredComp(),
        consts: 2,
        vars: 1,
        template: (rf: RenderFlags, ctx: StructuredComp) => {
          if (rf & RenderFlags.Create) {
            elementStart(0, 'section');
            template(1, (rf, ctx) => {
              if (rf & RenderFlags.Create) {
                elementStart(0, 'div');
                element(1, 'p');
                elementEnd();
                element(2, 'div');
              }
            }, 3, 0, 'ng-template', ['ngIf', '']);
            elementEnd();
          }
          if (rf & RenderFlags.Update) {
            elementProperty(1, 'ngIf', true);
          }
        }
      });
    }

    const fixture = new ComponentFixture(StructuredComp);
    fixture.update();

    const host = fixture.hostElement;
    const [section, div1, p, div2] = Array.from(host.querySelectorAll('section, div, p'));

    expect(section.nodeName.toLowerCase()).toBe('section');
    expect(section[MONKEY_PATCH_KEY_NAME]).toBeTruthy();

    expect(div1.nodeName.toLowerCase()).toBe('div');
    expect(div1[MONKEY_PATCH_KEY_NAME]).toBeTruthy();

    expect(p.nodeName.toLowerCase()).toBe('p');
    expect(p[MONKEY_PATCH_KEY_NAME]).toBeFalsy();

    expect(div2.nodeName.toLowerCase()).toBe('div');
    expect(div2[MONKEY_PATCH_KEY_NAME]).toBeTruthy();
  });

  it('should return a context object from a given dom node', () => {
    class StructuredComp {
      static ngComponentDef = defineComponent({
        type: StructuredComp,
        selectors: [['structured-comp']],
        directives: [NgIf],
        factory: () => new StructuredComp(),
        consts: 2,
        vars: 0,
        template: (rf: RenderFlags, ctx: StructuredComp) => {
          if (rf & RenderFlags.Create) {
            element(0, 'section');
            element(1, 'div');
          }
        }
      });
    }

    const fixture = new ComponentFixture(StructuredComp);
    fixture.update();

    const section = fixture.hostElement.querySelector('section') !;
    const sectionContext = getLContext(section) !;
    const sectionLView = sectionContext.lView !;
    expect(sectionContext.nodeIndex).toEqual(HEADER_OFFSET);
    expect(sectionLView.length).toBeGreaterThan(HEADER_OFFSET);
    expect(sectionContext.native).toBe(section);

    const div = fixture.hostElement.querySelector('div') !;
    const divContext = getLContext(div) !;
    const divLView = divContext.lView !;
    expect(divContext.nodeIndex).toEqual(HEADER_OFFSET + 1);
    expect(divLView.length).toBeGreaterThan(HEADER_OFFSET);
    expect(divContext.native).toBe(div);

    expect(divLView).toBe(sectionLView);
  });

  it('should cache the element context on a element was pre-emptively monkey-patched', () => {
    class StructuredComp {
      static ngComponentDef = defineComponent({
        type: StructuredComp,
        selectors: [['structured-comp']],
        factory: () => new StructuredComp(),
        consts: 1,
        vars: 0,
        template: (rf: RenderFlags, ctx: StructuredComp) => {
          if (rf & RenderFlags.Create) {
            element(0, 'section');
          }
        }
      });
    }

    const fixture = new ComponentFixture(StructuredComp);
    fixture.update();

    const section = fixture.hostElement.querySelector('section') !as any;
    const result1 = section[MONKEY_PATCH_KEY_NAME];
    expect(Array.isArray(result1)).toBeTruthy();

    const context = getLContext(section) !;
    const result2 = section[MONKEY_PATCH_KEY_NAME];
    expect(Array.isArray(result2)).toBeFalsy();

    expect(result2).toBe(context);
    expect(result2.lView).toBe(result1);
  });

  it('should cache the element context on an intermediate element that isn\'t pre-emptively monkey-patched',
     () => {
       class StructuredComp {
         static ngComponentDef = defineComponent({
           type: StructuredComp,
           selectors: [['structured-comp']],
           factory: () => new StructuredComp(),
           consts: 2,
           vars: 0,
           template: (rf: RenderFlags, ctx: StructuredComp) => {
             if (rf & RenderFlags.Create) {
               elementStart(0, 'section');
               element(1, 'p');
               elementEnd();
             }
           }
         });
       }

       const fixture = new ComponentFixture(StructuredComp);
       fixture.update();

       const section = fixture.hostElement.querySelector('section') !as any;
       expect(section[MONKEY_PATCH_KEY_NAME]).toBeTruthy();

       const p = fixture.hostElement.querySelector('p') !as any;
       expect(p[MONKEY_PATCH_KEY_NAME]).toBeFalsy();

       const pContext = getLContext(p) !;
       expect(pContext.native).toBe(p);
       expect(p[MONKEY_PATCH_KEY_NAME]).toBe(pContext);
     });

  it('should be able to pull in element context data even if the element is decorated using styling',
     () => {
       class StructuredComp {
         static ngComponentDef = defineComponent({
           type: StructuredComp,
           selectors: [['structured-comp']],
           factory: () => new StructuredComp(),
           consts: 1,
           vars: 0,
           template: (rf: RenderFlags, ctx: StructuredComp) => {
             if (rf & RenderFlags.Create) {
               elementStart(0, 'section');
               elementStyling(['class-foo']);
               elementEnd();
             }
             if (rf & RenderFlags.Update) {
               elementStylingApply(0);
             }
           }
         });
       }

       const fixture = new ComponentFixture(StructuredComp);
       fixture.update();

       const section = fixture.hostElement.querySelector('section') !as any;
       const result1 = section[MONKEY_PATCH_KEY_NAME];
       expect(Array.isArray(result1)).toBeTruthy();

       const elementResult = result1[HEADER_OFFSET];  // first element
       expect(Array.isArray(elementResult)).toBeTruthy();
       expect(elementResult[StylingIndex.ElementPosition]).toBe(section);

       const context = getLContext(section) !;
       const result2 = section[MONKEY_PATCH_KEY_NAME];
       expect(Array.isArray(result2)).toBeFalsy();

       expect(context.native).toBe(section);
     });

  it('should monkey-patch immediate child nodes in a content-projected region with a reference to the parent component',
     () => {
       /*
         <!-- DOM view -->
         <section>
           <projection-comp>
             welcome
             <header>
               <h1>
                 <p>this content is projected</p>
                 this content is projected also
               </h1>
             </header>
           </projection-comp>
         </section>
       */
       class ProjectorComp {
         static ngComponentDef = defineComponent({
           type: ProjectorComp,
           selectors: [['projector-comp']],
           factory: () => new ProjectorComp(),
           consts: 4,
           vars: 0,
           template: (rf: RenderFlags, ctx: ProjectorComp) => {
             if (rf & RenderFlags.Create) {
               projectionDef();
               text(0, 'welcome');
               elementStart(1, 'header');
               elementStart(2, 'h1');
               projection(3);
               elementEnd();
               elementEnd();
             }
             if (rf & RenderFlags.Update) {
             }
           }
         });
       }

       class ParentComp {
         static ngComponentDef = defineComponent({
           type: ParentComp,
           selectors: [['parent-comp']],
           directives: [ProjectorComp],
           factory: () => new ParentComp(),
           consts: 5,
           vars: 0,
           template: (rf: RenderFlags, ctx: ParentComp) => {
             if (rf & RenderFlags.Create) {
               elementStart(0, 'section');
               elementStart(1, 'projector-comp');
               elementStart(2, 'p');
               text(3, 'this content is projected');
               elementEnd();
               text(4, 'this content is projected also');
               elementEnd();
               elementEnd();
             }
           }
         });
       }

       const fixture = new ComponentFixture(ParentComp);
       fixture.update();

       const host = fixture.hostElement;
       const textNode = host.firstChild as any;
       const section = host.querySelector('section') !as any;
       const projectorComp = host.querySelector('projector-comp') !as any;
       const header = host.querySelector('header') !as any;
       const h1 = host.querySelector('h1') !as any;
       const p = host.querySelector('p') !as any;
       const pText = p.firstChild as any;
       const projectedTextNode = p.nextSibling;

       expect(projectorComp.children).toContain(header);
       expect(h1.children).toContain(p);

       expect(textNode[MONKEY_PATCH_KEY_NAME]).toBeTruthy();
       expect(section[MONKEY_PATCH_KEY_NAME]).toBeTruthy();
       expect(projectorComp[MONKEY_PATCH_KEY_NAME]).toBeTruthy();
       expect(header[MONKEY_PATCH_KEY_NAME]).toBeTruthy();
       expect(h1[MONKEY_PATCH_KEY_NAME]).toBeFalsy();
       expect(p[MONKEY_PATCH_KEY_NAME]).toBeTruthy();
       expect(pText[MONKEY_PATCH_KEY_NAME]).toBeFalsy();
       expect(projectedTextNode[MONKEY_PATCH_KEY_NAME]).toBeTruthy();

       const parentContext = getLContext(section) !;
       const shadowContext = getLContext(header) !;
       const projectedContext = getLContext(p) !;

       const parentComponentData = parentContext.lView;
       const shadowComponentData = shadowContext.lView;
       const projectedComponentData = projectedContext.lView;

       expect(projectedComponentData).toBe(parentComponentData);
       expect(shadowComponentData).not.toBe(parentComponentData);
     });

  it('should return `null` when an element context is retrieved that isn\'t situated in Angular',
     () => {
       const elm1 = document.createElement('div');
       const context1 = getLContext(elm1);
       expect(context1).toBeFalsy();

       const elm2 = document.createElement('div');
       document.body.appendChild(elm2);
       const context2 = getLContext(elm2);
       expect(context2).toBeFalsy();
     });

  it('should return `null` when an element context is retrieved that is a DOM node that was not created by Angular',
     () => {
       class StructuredComp {
         static ngComponentDef = defineComponent({
           type: StructuredComp,
           selectors: [['structured-comp']],
           factory: () => new StructuredComp(),
           consts: 1,
           vars: 0,
           template: (rf: RenderFlags, ctx: StructuredComp) => {
             if (rf & RenderFlags.Create) {
               element(0, 'section');
             }
           }
         });
       }

       const fixture = new ComponentFixture(StructuredComp);
       fixture.update();

       const section = fixture.hostElement.querySelector('section') !as any;
       const manuallyCreatedElement = document.createElement('div');
       section.appendChild(manuallyCreatedElement);

       const context = getLContext(manuallyCreatedElement);
       expect(context).toBeFalsy();
     });

  it('should by default monkey-patch the bootstrap component with context details', () => {
    class StructuredComp {
      static ngComponentDef = defineComponent({
        type: StructuredComp,
        selectors: [['structured-comp']],
        factory: () => new StructuredComp(),
        consts: 0,
        vars: 0,
        template: (rf: RenderFlags, ctx: StructuredComp) => {}
      });
    }

    const fixture = new ComponentFixture(StructuredComp);
    fixture.update();

    const hostElm = fixture.hostElement;
    const component = fixture.component;

    const componentLView = (component as any)[MONKEY_PATCH_KEY_NAME];
    expect(Array.isArray(componentLView)).toBeTruthy();

    const hostLView = (hostElm as any)[MONKEY_PATCH_KEY_NAME];
    expect(hostLView).toBe(componentLView);

    const context1 = getLContext(hostElm) !;
    expect(context1.lView).toBe(hostLView);
    expect(context1.native).toEqual(hostElm);

    const context2 = getLContext(component) !;
    expect(context2).toBe(context1);
    expect(context2.lView).toBe(hostLView);
    expect(context2.native).toEqual(hostElm);
  });

  it('should by default monkey-patch the directives with LView so that they can be examined',
     () => {
       let myDir1Instance: MyDir1|null = null;
       let myDir2Instance: MyDir2|null = null;
       let myDir3Instance: MyDir2|null = null;

       class MyDir1 {
         static ngDirectiveDef = defineDirective({
           type: MyDir1,
           selectors: [['', 'my-dir-1', '']],
           factory: () => myDir1Instance = new MyDir1()
         });
       }

       class MyDir2 {
         static ngDirectiveDef = defineDirective({
           type: MyDir2,
           selectors: [['', 'my-dir-2', '']],
           factory: () => myDir2Instance = new MyDir2()
         });
       }

       class MyDir3 {
         static ngDirectiveDef = defineDirective({
           type: MyDir3,
           selectors: [['', 'my-dir-3', '']],
           factory: () => myDir3Instance = new MyDir2()
         });
       }

       class StructuredComp {
         static ngComponentDef = defineComponent({
           type: StructuredComp,
           selectors: [['structured-comp']],
           directives: [MyDir1, MyDir2, MyDir3],
           factory: () => new StructuredComp(),
           consts: 2,
           vars: 0,
           template: (rf: RenderFlags, ctx: StructuredComp) => {
             if (rf & RenderFlags.Create) {
               element(0, 'div', ['my-dir-1', '', 'my-dir-2', '']);
               element(1, 'div', ['my-dir-3']);
             }
           }
         });
       }

       const fixture = new ComponentFixture(StructuredComp);
       fixture.update();

       const hostElm = fixture.hostElement;
       const div1 = hostElm.querySelector('div:first-child') !as any;
       const div2 = hostElm.querySelector('div:last-child') !as any;
       const context = getLContext(hostElm) !;
       const componentView = context.lView[context.nodeIndex];

       expect(componentView).toContain(myDir1Instance);
       expect(componentView).toContain(myDir2Instance);
       expect(componentView).toContain(myDir3Instance);

       expect(Array.isArray((myDir1Instance as any)[MONKEY_PATCH_KEY_NAME])).toBeTruthy();
       expect(Array.isArray((myDir2Instance as any)[MONKEY_PATCH_KEY_NAME])).toBeTruthy();
       expect(Array.isArray((myDir3Instance as any)[MONKEY_PATCH_KEY_NAME])).toBeTruthy();

       const d1Context = getLContext(myDir1Instance) !;
       const d2Context = getLContext(myDir2Instance) !;
       const d3Context = getLContext(myDir3Instance) !;

       expect(d1Context.lView).toEqual(componentView);
       expect(d2Context.lView).toEqual(componentView);
       expect(d3Context.lView).toEqual(componentView);

       expect((myDir1Instance as any)[MONKEY_PATCH_KEY_NAME]).toBe(d1Context);
       expect((myDir2Instance as any)[MONKEY_PATCH_KEY_NAME]).toBe(d2Context);
       expect((myDir3Instance as any)[MONKEY_PATCH_KEY_NAME]).toBe(d3Context);

       expect(d1Context.nodeIndex).toEqual(HEADER_OFFSET);
       expect(d1Context.native).toBe(div1);
       expect(d1Context.directives as any[]).toEqual([myDir1Instance, myDir2Instance]);

       expect(d2Context.nodeIndex).toEqual(HEADER_OFFSET);
       expect(d2Context.native).toBe(div1);
       expect(d2Context.directives as any[]).toEqual([myDir1Instance, myDir2Instance]);

       expect(d3Context.nodeIndex).toEqual(HEADER_OFFSET + 1);
       expect(d3Context.native).toBe(div2);
       expect(d3Context.directives as any[]).toEqual([myDir3Instance]);
     });

  it('should monkey-patch the exact same context instance of the DOM node, component and any directives on the same element',
     () => {
       let myDir1Instance: MyDir1|null = null;
       let myDir2Instance: MyDir2|null = null;
       let childComponentInstance: ChildComp|null = null;

       class MyDir1 {
         static ngDirectiveDef = defineDirective({
           type: MyDir1,
           selectors: [['', 'my-dir-1', '']],
           factory: () => myDir1Instance = new MyDir1()
         });
       }

       class MyDir2 {
         static ngDirectiveDef = defineDirective({
           type: MyDir2,
           selectors: [['', 'my-dir-2', '']],
           factory: () => myDir2Instance = new MyDir2()
         });
       }

       class ChildComp {
         static ngComponentDef = defineComponent({
           type: ChildComp,
           selectors: [['child-comp']],
           factory: () => childComponentInstance = new ChildComp(),
           consts: 1,
           vars: 0,
           template: (rf: RenderFlags, ctx: ChildComp) => {
             if (rf & RenderFlags.Create) {
               element(0, 'div');
             }
           }
         });
       }

       class ParentComp {
         static ngComponentDef = defineComponent({
           type: ParentComp,
           selectors: [['parent-comp']],
           directives: [ChildComp, MyDir1, MyDir2],
           factory: () => new ParentComp(),
           consts: 1,
           vars: 0,
           template: (rf: RenderFlags, ctx: ParentComp) => {
             if (rf & RenderFlags.Create) {
               element(0, 'child-comp', ['my-dir-1', '', 'my-dir-2', '']);
             }
           }
         });
       }

       const fixture = new ComponentFixture(ParentComp);
       fixture.update();

       const childCompHostElm = fixture.hostElement.querySelector('child-comp') !as any;

       const lView = childCompHostElm[MONKEY_PATCH_KEY_NAME];
       expect(Array.isArray(lView)).toBeTruthy();
       expect((myDir1Instance as any)[MONKEY_PATCH_KEY_NAME]).toBe(lView);
       expect((myDir2Instance as any)[MONKEY_PATCH_KEY_NAME]).toBe(lView);
       expect((childComponentInstance as any)[MONKEY_PATCH_KEY_NAME]).toBe(lView);

       const childNodeContext = getLContext(childCompHostElm) !;
       expect(childNodeContext.component).toBeFalsy();
       expect(childNodeContext.directives).toBeFalsy();
       assertMonkeyPatchValueIsLView(myDir1Instance);
       assertMonkeyPatchValueIsLView(myDir2Instance);
       assertMonkeyPatchValueIsLView(childComponentInstance);

       expect(getLContext(myDir1Instance)).toBe(childNodeContext);
       expect(childNodeContext.component).toBeFalsy();
       expect(childNodeContext.directives !.length).toEqual(2);
       assertMonkeyPatchValueIsLView(myDir1Instance, false);
       assertMonkeyPatchValueIsLView(myDir2Instance, false);
       assertMonkeyPatchValueIsLView(childComponentInstance);

       expect(getLContext(myDir2Instance)).toBe(childNodeContext);
       expect(childNodeContext.component).toBeFalsy();
       expect(childNodeContext.directives !.length).toEqual(2);
       assertMonkeyPatchValueIsLView(myDir1Instance, false);
       assertMonkeyPatchValueIsLView(myDir2Instance, false);
       assertMonkeyPatchValueIsLView(childComponentInstance);

       expect(getLContext(childComponentInstance)).toBe(childNodeContext);
       expect(childNodeContext.component).toBeTruthy();
       expect(childNodeContext.directives !.length).toEqual(2);
       assertMonkeyPatchValueIsLView(myDir1Instance, false);
       assertMonkeyPatchValueIsLView(myDir2Instance, false);
       assertMonkeyPatchValueIsLView(childComponentInstance, false);

       function assertMonkeyPatchValueIsLView(value: any, yesOrNo = true) {
         expect(Array.isArray((value as any)[MONKEY_PATCH_KEY_NAME])).toBe(yesOrNo);
       }
     });

  it('should monkey-patch sub components with the view data and then replace them with the context result once a lookup occurs',
     () => {
       class ChildComp {
         static ngComponentDef = defineComponent({
           type: ChildComp,
           selectors: [['child-comp']],
           factory: () => new ChildComp(),
           consts: 3,
           vars: 0,
           template: (rf: RenderFlags, ctx: ChildComp) => {
             if (rf & RenderFlags.Create) {
               element(0, 'div');
               element(1, 'div');
               element(2, 'div');
             }
           }
         });
       }

       class ParentComp {
         static ngComponentDef = defineComponent({
           type: ParentComp,
           selectors: [['parent-comp']],
           directives: [ChildComp],
           factory: () => new ParentComp(),
           consts: 2,
           vars: 0,
           template: (rf: RenderFlags, ctx: ParentComp) => {
             if (rf & RenderFlags.Create) {
               elementStart(0, 'section');
               elementStart(1, 'child-comp');
               elementEnd();
               elementEnd();
             }
           }
         });
       }

       const fixture = new ComponentFixture(ParentComp);
       fixture.update();

       const host = fixture.hostElement;
       const child = host.querySelector('child-comp') as any;
       expect(child[MONKEY_PATCH_KEY_NAME]).toBeTruthy();

       const context = getLContext(child) !;
       expect(child[MONKEY_PATCH_KEY_NAME]).toBeTruthy();

       const componentData = context.lView[context.nodeIndex];
       const component = componentData[CONTEXT];
       expect(component instanceof ChildComp).toBeTruthy();
       expect(component[MONKEY_PATCH_KEY_NAME]).toBe(context.lView);

       const componentContext = getLContext(component) !;
       expect(component[MONKEY_PATCH_KEY_NAME]).toBe(componentContext);
       expect(componentContext.nodeIndex).toEqual(context.nodeIndex);
       expect(componentContext.native).toEqual(context.native);
       expect(componentContext.lView).toEqual(context.lView);
     });
});

describe('sanitization', () => {
  it('should sanitize data using the provided sanitization interface', () => {
    class SanitizationComp {
      static ngComponentDef = defineComponent({
        type: SanitizationComp,
        selectors: [['sanitize-this']],
        factory: () => new SanitizationComp(),
        consts: 1,
        vars: 1,
        template: (rf: RenderFlags, ctx: SanitizationComp) => {
          if (rf & RenderFlags.Create) {
            element(0, 'a');
          }
          if (rf & RenderFlags.Update) {
            elementProperty(0, 'href', bind(ctx.href), sanitizeUrl);
          }
        }
      });

      private href = '';

      updateLink(href: any) { this.href = href; }
    }

    const sanitizer = new LocalSanitizer((value) => { return 'http://bar'; });

    const fixture = new ComponentFixture(SanitizationComp, {sanitizer});
    fixture.component.updateLink('http://foo');
    fixture.update();

    const anchor = fixture.hostElement.querySelector('a') !;
    expect(anchor.getAttribute('href')).toEqual('http://bar');

    fixture.component.updateLink(sanitizer.bypassSecurityTrustUrl('http://foo'));
    fixture.update();

    expect(anchor.getAttribute('href')).toEqual('http://foo');
  });

  it('should sanitize HostBindings data using provided sanitization interface', () => {
    let hostBindingDir: UnsafeUrlHostBindingDir;
    class UnsafeUrlHostBindingDir {
      // @HostBinding()
      cite: any = 'http://cite-dir-value';

      static ngDirectiveDef = defineDirective({
        type: UnsafeUrlHostBindingDir,
        selectors: [['', 'unsafeUrlHostBindingDir', '']],
        factory: () => hostBindingDir = new UnsafeUrlHostBindingDir(),
        hostBindings: (rf: RenderFlags, ctx: any, elementIndex: number) => {
          if (rf & RenderFlags.Create) {
            allocHostVars(1);
          }
          if (rf & RenderFlags.Update) {
            elementProperty(elementIndex, 'cite', bind(ctx.cite), sanitizeUrl, true);
          }
        }
      });
    }

    class SimpleComp {
      static ngComponentDef = defineComponent({
        type: SimpleComp,
        selectors: [['sanitize-this']],
        factory: () => new SimpleComp(),
        consts: 1,
        vars: 0,
        template: (rf: RenderFlags, ctx: SimpleComp) => {
          if (rf & RenderFlags.Create) {
            element(0, 'blockquote', ['unsafeUrlHostBindingDir', '']);
          }
        },
        directives: [UnsafeUrlHostBindingDir]
      });
    }

    const sanitizer = new LocalSanitizer((value) => 'http://bar');

    const fixture = new ComponentFixture(SimpleComp, {sanitizer});
    hostBindingDir !.cite = 'http://foo';
    fixture.update();

    const anchor = fixture.hostElement.querySelector('blockquote') !;
    expect(anchor.getAttribute('cite')).toEqual('http://bar');

    hostBindingDir !.cite = sanitizer.bypassSecurityTrustUrl('http://foo');
    fixture.update();

    expect(anchor.getAttribute('cite')).toEqual('http://foo');
  });
});

class LocalSanitizedValue {
  constructor(public value: any) {}
  toString() { return this.value; }
}

class LocalSanitizer implements Sanitizer {
  constructor(private _interceptor: (value: string|null|any) => string) {}

  sanitize(context: SecurityContext, value: LocalSanitizedValue|string|null): string|null {
    if (value instanceof LocalSanitizedValue) {
      return value.toString();
    }
    return this._interceptor(value);
  }

  bypassSecurityTrustHtml(value: string) {}
  bypassSecurityTrustStyle(value: string) {}
  bypassSecurityTrustScript(value: string) {}
  bypassSecurityTrustResourceUrl(value: string) {}

  bypassSecurityTrustUrl(value: string) { return new LocalSanitizedValue(value); }
}

class ProxyRenderer3Factory implements RendererFactory3 {
  lastCapturedType: RendererType2|null = null;

  createRenderer(hostElement: RElement|null, rendererType: RendererType2|null): Renderer3 {
    this.lastCapturedType = rendererType;
    return domRendererFactory3.createRenderer(hostElement, rendererType);
  }
}
