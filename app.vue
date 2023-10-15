<script setup lang="ts">
import { onMounted } from "vue";
const { $socket } = useNuxtApp();

onMounted(() => {
  $socket.connect();
});
</script>
<template>
  <div>
    <h1>Slaterbot</h1>
    <DataUpdate />
  </div>
</template>
