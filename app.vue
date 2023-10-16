<script setup lang="ts">
import { ref, onMounted } from "vue";
const { $socket } = useNuxtApp();

const engineData = ref({});

onMounted(() => {
  $socket.on("update", (data) => {
    engineData.value = { ...data };
  });

  $socket.connect();
});
</script>
<template>
  <div>
    <h1>Slaterbot</h1>
    <DataDisplay title="Positions" />
    {{ engineData }}
  </div>
</template>
