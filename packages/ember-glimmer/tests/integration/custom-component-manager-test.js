import { moduleFor, RenderingTest } from '../utils/test-case';
import { strip } from '../utils/abstract-test-case';

import { Object as EmberObject } from 'ember-runtime';
import { set, setProperties, computed } from 'ember-metal';
import { GLIMMER_CUSTOM_COMPONENT_MANAGER } from '@ember/canary-features';
import { setComponentManager, capabilities } from 'ember-glimmer';
import { assign } from '@ember/polyfills';

const MANAGER_ID = 'test-custom';

const CustomComponent = setComponentManager(MANAGER_ID, EmberObject.extend());

if (GLIMMER_CUSTOM_COMPONENT_MANAGER) {
  moduleFor(
    'Component Manager',
    class extends RenderingTest {
      /*
     * Helper to register a custom component manager. Provides a basic, default
     * implementation of the custom component manager API, but can be overridden
     * by passing custom hooks.
     */
      registerCustomComponentManager(overrides = {}) {
        let options = assign(
          {
            capabilities: capabilities('3.4'),

            createComponent(ComponentClass) {
              return ComponentClass.create();
            },

            getContext(component) {
              return component;
            },

            updateComponent() {},
          },
          overrides
        );

        this.owner.register(`component-manager:${MANAGER_ID}`, options, {
          singleton: true,
          instantiate: false,
        });
      }

      // Renders a simple component with a custom component manager and verifies
      // that properties from the component are accessible from the component's
      // template.
      ['@test it can render a basic component with custom component manager']() {
        this.registerCustomComponentManager();

        let ComponentClass = CustomComponent.extend({
          greeting: 'hello',
        });

        this.registerComponent('foo-bar', {
          template: `<p>{{greeting}} world</p>`,
          ComponentClass,
        });

        this.render('{{foo-bar}}');

        this.assertHTML(strip`<p>hello world</p>`);
      }

      // Tests the custom component manager's ability to override template context
      // by implementing the getContext hook. Test performs an initial render and
      // updating render and verifies that output came from the custom context,
      // not the component instance.
      ['@test it can customize the template context']() {
        let customContext = {
          greeting: 'goodbye',
        };

        this.registerCustomComponentManager({
          getContext() {
            return customContext;
          },
        });

        let ComponentClass = CustomComponent.extend({
          greeting: 'hello',
          count: 1234,
        });

        this.registerComponent('foo-bar', {
          template: `<p>{{greeting}} world {{count}}</p>`,
          ComponentClass,
        });

        this.render('{{foo-bar}}');

        this.assertHTML(strip`<p>goodbye world </p>`);

        this.runTask(() => set(customContext, 'greeting', 'sayonara'));

        this.assertHTML(strip`<p>sayonara world </p>`);
      }

      ['@test it can set arguments on the component instance']() {
        this.registerCustomComponentManager({
          createComponent(ComponentClass, { named }) {
            return ComponentClass.create({ args: named });
          },
        });

        let ComponentClass = CustomComponent.extend({
          salutation: computed('args.firstName', 'args.lastName', function() {
            return this.get('args.firstName') + ' ' + this.get('args.lastName');
          }),
        });

        this.registerComponent('foo-bar', {
          template: `<p>{{salutation}}</p>`,
          ComponentClass,
        });

        this.render('{{foo-bar firstName="Yehuda" lastName="Katz"}}');

        this.assertHTML(strip`<p>Yehuda Katz</p>`);
      }

      ['@test arguments are updated if they change']() {
        this.registerCustomComponentManager({
          createComponent(ComponentClass, { named }) {
            return ComponentClass.create({ args: named });
          },

          updateComponent(component, { named }) {
            set(component, 'args', named);
          },
        });

        let ComponentClass = CustomComponent.extend({
          salutation: computed('args.firstName', 'args.lastName', function() {
            return this.get('args.firstName') + ' ' + this.get('args.lastName');
          }),
        });

        this.registerComponent('foo-bar', {
          template: `<p>{{salutation}}</p>`,
          ComponentClass,
        });

        this.render('{{foo-bar firstName=firstName lastName=lastName}}', {
          firstName: 'Yehuda',
          lastName: 'Katz',
        });

        this.assertHTML(strip`<p>Yehuda Katz</p>`);

        this.runTask(() =>
          setProperties(this.context, {
            firstName: 'Chad',
            lastName: 'Hietala',
          })
        );

        this.assertHTML(strip`<p>Chad Hietala</p>`);
      }
    }
  );
}
