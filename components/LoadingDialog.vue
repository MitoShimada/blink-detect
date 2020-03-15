<template>
  <v-row justify="center">
    <v-dialog v-model="visible" persistent max-width="600">
      <v-card>
        <v-card-title class="headline" />
        <v-card-text>
          <p>{{ bodyLoading }}</p>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-row>
</template>
<script>
export default {
  props: {
    visible: {
      type: Boolean
    }
  },
  data () {
    return {
      bodyLoading: '顔認識モデルを読み込んでいます。少々お待ちください。',
    }
  }
}
</script>

<style scoped>
.c_howto {
  width: 100%;
}
</style>
