<template>
  <v-app dark>
    <v-navigation-drawer
      v-model="drawer"
      :mini-variant="miniVariant"
      :clipped="clipped"
      fixed
      app
    >
      <v-list>
        <v-list-item
          v-for="(item, i) in items"
          :key="i"
          :to="item.to"
          router
          exact
        >
          <v-list-item-action>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title v-text="item.title" />
          </v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-action>
            <v-icon>mdi-blogger</v-icon>
          </v-list-item-action>
          <v-list-item-content @click="toHarassment">
            <v-list-item-title>
              AIパワハラ文章診断
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-action>
            <v-icon>mdi-face-woman</v-icon>
          </v-list-item-action>
          <v-list-item-content @click="toTouchLip">
            <v-list-item-title>
              Touch Lip
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item>
          <v-list-item-action>
            <v-icon>mdi-blogger</v-icon>
          </v-list-item-action>
          <v-list-item-content @click="toBlog">
            <v-list-item-title>
              Blog
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <v-app-bar
      :clipped-left="clipped"
      fixed
      app
    >
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title v-text="title" />
      <v-spacer />
    </v-app-bar>
    <v-content>
      <v-container>
        <nuxt />
      </v-container>
    </v-content>
    <v-footer
      :fixed="fixed"
      app
    >
      <span>水卜 - &copy; 2020</span>
    </v-footer>
    <loading-dialog :visible="loading" />
  </v-app>
</template>

<script>
import LoadingDialog from '../components/LoadingDialog'
export default {
  components: {
    LoadingDialog,
  },
  data () {
    return {
      clipped: false,
      drawer: false,
      fixed: false,
      items: [
        {
          icon: 'mdi-eye',
          title: 'Binarization',
          to: '/'
        },
        {
          icon: 'mdi-eye',
          title: 'Eye Aspect Ratio',
          to: '/ear'
        },
      ],
      miniVariant: false,
      right: true,
      rightDrawer: false,
      title: '睡眠検知デモ'
    }
  },
  computed: {
    loading () {
      return this.$store.state.face.loading
    }
  },
  async mounted () {
    const self = this
    await self.$store.dispatch('face/load')
  },
  methods: {
    toBlog () {
      window.open('https://www.koatech.info', '_blank')
    },
    toHarassment () {
      window.open('https://harassment.koatech.info', '_blank')
    },
    toTouchLip () {
      window.open('https://touchlip.koatech.info', '_blank')
    }
  }
}
</script>
