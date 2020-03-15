<template>
  <v-alert
    :color="colors[safetyIndicator]"
    dark
    border="left"
    prominent
    type="info"
  >
    <v-row align="center">
      <v-col class="grow">
        {{ messages[safetyIndicator] }}
      </v-col>
    </v-row>
  </v-alert>
</template>

<script>
export default {
  props: {
    sleep: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      colors: {
        0: 'success',
        1: 'red',
      },
      messages: {
        0: 'Awake',
        1: 'Sleep',
      },
    }
  },
  computed: {
    safetyIndicator () {
      if (this.sleep) {
        return 1
      } else {
        return 0
      }
    }
  },
}
</script>

<style scoped>
</style>
