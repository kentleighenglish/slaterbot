<script setup lang="ts">
import { ref, onMounted, inject } from "vue";
const { $socket } = useNuxtApp();

const engineData = ref({});

onMounted(() => {
  $socket.on("update", (data) => {
    engineData.value = { ...data };
  });

  $socket.connect();
});

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `Slaterbot | ${titleChunk}` : "Slaterbot";
  }
});
</script>
<template>
  <NuxtPage :engineData="engineData" />
</template>
