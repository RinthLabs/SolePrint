import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView   from '../views/HomeView.vue'
import UploadView from '../views/UploadView.vue'
import PreviewView from '../views/PreviewView.vue'

const routes = [
  { path: '/',        name: 'Home',    component: HomeView },
  { path: '/upload',  name: 'Upload',  component: UploadView },
  { path: '/preview', name: 'Preview', component: PreviewView },
  // Legacy redirect — /results used to be a separate page
  { path: '/results', redirect: '/preview' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() { return { top: 0 } }
})

export default router
