(function () {
'use strict';

let timerDebounce = undefined;
function debounce(duration, callback) {
  clearTimeout(timerDebounce);
  timerDebounce = setTimeout(function () {
    callback();
  }, duration);
  return timerDebounce;
}
function transitionAsPromise(triggeringFunc, el) {
  return new Promise(resolve => {
    const handleTransitionEnd = () => {
      el.removeEventListener('transitionend', handleTransitionEnd);
      resolve();
    };

    el.addEventListener('transitionend', handleTransitionEnd);
    const classesBefore = el.getAttribute('class');
    const stylesBefore = el.getAttribute('style');
    triggeringFunc();

    if (classesBefore === el.getAttribute('class') && stylesBefore === el.getAttribute('style')) {
      handleTransitionEnd();
    }

    if (parseFloat(getComputedStyle(el)['transitionDuration']) === 0) {
      handleTransitionEnd();
    }
  });
}
function loadImage({
  src,
  srcset,
  sizes
}) {
  const image = new Image();
  image.src = src;

  if (srcset) {
    image.srcset = srcset;
  }

  if (sizes) {
    image.sizes = sizes;
  }

  if ('decode' in image) {
    return new Promise((resolve, reject) => {
      image.decode().then(() => {
        resolve(image);
      }).catch(() => {
        reject(image);
      });
    });
  } else {
    return new Promise((resolve, reject) => {
      image.onload = resolve(image);
      image.onerror = reject(image);
    });
  }
}
function fit(options) {
  let height;
  let width;
  const {
    imgHeight,
    imgWidth,
    containerHeight,
    containerWidth,
    canvasWidth,
    canvasHeight,
    imageSize
  } = options;
  const canvasRatio = canvasHeight / canvasWidth;
  const containerRatio = containerHeight / containerWidth;
  const imgRatio = imgHeight / imgWidth;

  if (imageSize == 'cover') {
    if (imgRatio < containerRatio) {
      height = containerHeight;
      width = height / imgRatio;
    } else {
      width = containerWidth;
      height = width * imgRatio;
    }
  } else if (imageSize == 'native') {
    height = imgHeight;
    width = imgWidth;
  } else {
    if (imgRatio > canvasRatio) {
      height = canvasHeight;
      width = height / imgRatio;
    } else {
      width = canvasWidth;
      height = width * imgRatio;
    }

    if (imageSize === 'scale-down' && (width >= imgWidth || height >= imgHeight)) {
      width = imgWidth;
      height = imgHeight;
    }
  }

  return {
    height: height,
    width: width
  };
}
function openFullScreen(wrapper) {
  if (wrapper.requestFullscreen) {
    wrapper.requestFullscreen();
    return true;
  } else if (wrapper.webkitRequestFullscreen) {
    wrapper.webkitRequestFullscreen();
    return true;
  } else if (wrapper.msRequestFullscreen) {
    wrapper.msRequestFullscreen();
    return true;
  } else {
    return false;
  }
}
function exitFullScreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
    return false;
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
    return false;
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
    return false;
  } else {
    return true;
  }
}

const defaults = {
  container: document.body,
  // window or element
  className: undefined,
  imageSize: 'scale-down',
  // 'scale-down', 'contain', 'cover' or 'native'
  fullScreen: false,
  loop: false,
  linkImages: true,
  setIndex: 0,
  firstImageIndex: 0,
  lastImageIndex: false,
  currentImageIndex: undefined,
  allowZoom: true,
  closeOnBackgroundClick: true,
  setTitle: function () {
    return '';
  },
  description: function () {
    return this.images[this.settings.currentImageIndex].title;
  },
  pagination: function () {
    const last = this.settings.lastImageIndex + 1;
    const position = this.settings.currentImageIndex + 1;
    return position + '/' + last;
  },

  afterInitialize() {},

  afterMarkup() {},

  afterImageLoad() {},

  zoomedPaddingX: function (canvasWidth, imgWidth) {
    return 0;
  },
  zoomedPaddingY: function (canvasHeight, imgHeight) {
    return 0;
  }
};
class Chocolat {
  constructor(elements, settings) {
    this.settings = settings;
    this.elems = {};
    this.images = [];
    this.events = [];
    this.state = {
      fullScreenOpen: false,
      initialZoomState: null,
      initialized: false,
      timer: false,
      visible: false
    };
    this._cssClasses = ['chocolat-open', 'chocolat-in-container', 'chocolat-cover', 'chocolat-zoomable', 'chocolat-zoomed', 'chocolat-zooming-in', 'chocolat-zooming-out'];

    if (NodeList.prototype.isPrototypeOf(elements) || HTMLCollection.prototype.isPrototypeOf(elements)) {
      elements.forEach((el, i) => {
        this.images.push({
          title: el.getAttribute('title'),
          src: el.getAttribute('href'),
          srcset: el.getAttribute('data-srcset'),
          sizes: el.getAttribute('data-sizes')
        });
        this.off(el, 'click.chocolat');
        this.on(el, 'click.chocolat', e => {
          this.init(i);
          e.preventDefault();
        });
      });
    } else {
      this.images = elements;
    }

    if (this.settings.container instanceof Element || this.settings.container instanceof HTMLElement) {
      this.elems.container = this.settings.container;
    } else {
      this.elems.container = document.body;
    }

    this.api = {
      open: i => {
        i = parseInt(i) || 0;
        return this.init(i);
      },
      close: () => {
        return this.close();
      },
      next: () => {
        return this.change(1);
      },
      prev: () => {
        return this.change(-1);
      },
      goto: i => {
        return this.open(i);
      },
      current: () => {
        return this.settings.currentImageIndex;
      },
      position: () => {
        return this.position(this.elems.img);
      },
      destroy: () => {
        return this.destroy();
      },
      set: (property, value) => {
        this.settings[property] = value;
        return value;
      },
      get: property => {
        return this.settings[property];
      },
      getElem: name => {
        return this.elems[name];
      }
    };
  }

  init(i) {
    if (!this.state.initialized) {
      this.markup();
      this.attachListeners();
      this.settings.lastImageIndex = this.images.length - 1;
      this.state.initialized = true;
    }

    this.settings.afterInitialize.call(this);
    return this.load(i);
  }

  load(index) {
    if (!this.state.visible) {
      this.state.visible = true;
      setTimeout(() => {
        this.elems.overlay.classList.add('chocolat-visible');
        this.elems.wrapper.classList.add('chocolat-visible');
      }, 0);
      this.elems.container.classList.add('chocolat-open');
    }

    if (this.settings.fullScreen) {
      this.state.fullScreenOpen = openFullScreen(this.elems.wrapper);
    }

    if (this.settings.currentImageIndex === index) {
      return Promise.resolve();
    }

    let loaderTimer = setTimeout(() => {
      this.elems.loader.classList.add('chocolat-visible');
    }, 1000);
    let fadeOutPromise;
    let image;
    let fadeOutTimer = setTimeout(() => {
      fadeOutTimer = undefined;
      fadeOutPromise = transitionAsPromise(() => {
        this.elems.imageCanvas.classList.remove('chocolat-visible');
      }, this.elems.imageCanvas);
    }, 80);
    return loadImage(this.images[index]).then(loadedImage => {
      image = loadedImage;

      if (fadeOutTimer) {
        clearTimeout(fadeOutTimer);
        return Promise.resolve();
      } else {
        return fadeOutPromise;
      }
    }).then(() => {
      const nextIndex = index + 1;

      if (this.images[nextIndex] != undefined) {
        loadImage(this.images[nextIndex]);
      }

      this.settings.currentImageIndex = index;
      this.elems.description.textContent = this.settings.description.call(this);
      this.elems.pagination.textContent = this.settings.pagination.call(this);
      this.arrows();
      return this.position(image).then(() => {
        this.elems.loader.classList.remove('chocolat-visible');
        clearTimeout(loaderTimer);
        return this.appear(image);
      });
    }).then(() => {
      this.elems.container.classList.toggle('chocolat-zoomable', this.zoomable(image, this.elems.wrapper));
      this.settings.afterImageLoad.call(this);
    });
  }

  position({
    naturalHeight,
    naturalWidth
  }) {
    const fitOptions = {
      imgHeight: naturalHeight,
      imgWidth: naturalWidth,
      containerHeight: this.elems.container.clientHeight,
      containerWidth: this.elems.container.clientWidth,
      canvasWidth: this.elems.imageCanvas.clientWidth,
      canvasHeight: this.elems.imageCanvas.clientHeight,
      imageSize: this.settings.imageSize
    };
    const {
      width,
      height
    } = fit(fitOptions);
    return transitionAsPromise(() => {
      Object.assign(this.elems.imageWrapper.style, {
        width: width + 'px',
        height: height + 'px'
      });
    }, this.elems.imageWrapper);
  }

  appear(image) {
    this.elems.imageWrapper.removeChild(this.elems.img);
    this.elems.img = image;
    this.elems.img.setAttribute('class', 'chocolat-img');
    this.elems.imageWrapper.appendChild(this.elems.img);
    const fadeInPromise = transitionAsPromise(() => {
      this.elems.imageCanvas.classList.add('chocolat-visible');
    }, this.elems.imageCanvas);
    return fadeInPromise;
  }

  change(step) {
    if (!this.state.visible) {
      return;
    }

    this.zoomOut();
    const requestedImage = this.settings.currentImageIndex + parseInt(step);

    if (requestedImage > this.settings.lastImageIndex) {
      if (this.settings.loop) {
        return this.load(this.settings.firstImageIndex);
      }
    } else if (requestedImage < this.settings.firstImageIndex) {
      if (this.settings.loop) {
        return this.load(this.settings.lastImageIndex);
      }
    } else {
      return this.load(requestedImage);
    }
  }

  arrows() {
    if (this.settings.loop) {
      this.elems.left.classList.add('active');
      this.elems.right.classList.add('active');
    } else if (this.settings.linkImages) {
      this.elems.right.classList.toggle('active', this.settings.currentImageIndex !== this.settings.lastImageIndex);
      this.elems.left.classList.toggle('active', this.settings.currentImageIndex !== this.settings.firstImageIndex);
    } else {
      this.elems.left.classList.remove('active');
      this.elems.right.classList.remove('active');
    }
  }

  close() {
    if (this.state.fullScreenOpen) {
      this.state.fullScreenOpen = exitFullScreen();
      return;
    }

    this.state.visible = false;
    const promiseOverlay = transitionAsPromise(() => {
      this.elems.overlay.classList.remove('chocolat-visible');
    }, this.elems.overlay);
    const promiseWrapper = transitionAsPromise(() => {
      this.elems.wrapper.classList.remove('chocolat-visible');
    }, this.elems.wrapper);
    return Promise.all([promiseOverlay, promiseWrapper]).then(() => {
      this.elems.container.classList.remove('chocolat-open');
    });
  }

  destroy() {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const {
        element,
        eventName
      } = this.events[i];
      this.off(element, eventName);
    }

    if (!this.state.initialized) {
      return;
    }

    if (this.state.fullScreenOpen) {
      this.state.fullScreenOpen = exitFullScreen();
    }

    this.settings.currentImageIndex = undefined;
    this.state.visible = false;
    this.state.initialized = false;
    this.elems.container.classList.remove(...this._cssClasses);
    this.elems.wrapper.parentNode.removeChild(this.elems.wrapper);
  }

  markup() {
    this.elems.container.classList.add('chocolat-open', this.settings.className);

    if (this.settings.imageSize == 'cover') {
      this.elems.container.classList.add('chocolat-cover');
    }

    if (this.elems.container !== document.body) {
      this.elems.container.classList.add('chocolat-in-container');
    }

    this.elems.wrapper = document.createElement('div');
    this.elems.wrapper.setAttribute('id', 'chocolat-content-' + this.settings.setIndex);
    this.elems.wrapper.setAttribute('class', 'chocolat-wrapper');
    this.elems.container.appendChild(this.elems.wrapper);
    this.elems.overlay = document.createElement('div');
    this.elems.overlay.setAttribute('class', 'chocolat-overlay');
    this.elems.wrapper.appendChild(this.elems.overlay);
    this.elems.loader = document.createElement('div');
    this.elems.loader.setAttribute('class', 'chocolat-loader');
    this.elems.wrapper.appendChild(this.elems.loader);
    this.elems.layout = document.createElement('div');
    this.elems.layout.setAttribute('class', 'chocolat-layout');
    this.elems.wrapper.appendChild(this.elems.layout);
    this.elems.top = document.createElement('div');
    this.elems.top.setAttribute('class', 'chocolat-top');
    this.elems.layout.appendChild(this.elems.top);
    this.elems.center = document.createElement('div');
    this.elems.center.setAttribute('class', 'chocolat-center');
    this.elems.layout.appendChild(this.elems.center);
    this.elems.left = document.createElement('div');
    this.elems.left.setAttribute('class', 'chocolat-left');
    this.elems.center.appendChild(this.elems.left);
    this.elems.imageCanvas = document.createElement('div');
    this.elems.imageCanvas.setAttribute('class', 'chocolat-image-canvas');
    this.elems.center.appendChild(this.elems.imageCanvas);
    this.elems.imageWrapper = document.createElement('div');
    this.elems.imageWrapper.setAttribute('class', 'chocolat-image-wrapper');
    this.elems.imageCanvas.appendChild(this.elems.imageWrapper);
    this.elems.img = document.createElement('img');
    this.elems.img.setAttribute('class', 'chocolat-img');
    this.elems.imageWrapper.appendChild(this.elems.img);
    this.elems.right = document.createElement('div');
    this.elems.right.setAttribute('class', 'chocolat-right');
    this.elems.center.appendChild(this.elems.right);
    this.elems.bottom = document.createElement('div');
    this.elems.bottom.setAttribute('class', 'chocolat-bottom');
    this.elems.layout.appendChild(this.elems.bottom);
    this.elems.close = document.createElement('span');
    this.elems.close.setAttribute('class', 'chocolat-close');
    this.elems.top.appendChild(this.elems.close);
    this.elems.description = document.createElement('span');
    this.elems.description.setAttribute('class', 'chocolat-description');
    this.elems.bottom.appendChild(this.elems.description);
    this.elems.pagination = document.createElement('span');
    this.elems.pagination.setAttribute('class', 'chocolat-pagination');
    this.elems.bottom.appendChild(this.elems.pagination);
    this.elems.setTitle = document.createElement('span');
    this.elems.setTitle.setAttribute('class', 'chocolat-set-title');
    this.elems.setTitle.textContent = this.settings.setTitle();
    this.elems.bottom.appendChild(this.elems.setTitle);
    this.elems.fullscreen = document.createElement('span');
    this.elems.fullscreen.setAttribute('class', 'chocolat-fullscreen');
    this.elems.bottom.appendChild(this.elems.fullscreen);
    this.settings.afterMarkup.call(this);
  }

  attachListeners() {
    this.off(document, 'keydown.chocolat');
    this.on(document, 'keydown.chocolat', e => {
      if (this.state.initialized) {
        if (e.keyCode == 37) {
          this.change(-1);
        } else if (e.keyCode == 39) {
          this.change(1);
        } else if (e.keyCode == 27) {
          this.close();
        }
      }
    });
    const right = this.elems.wrapper.querySelector('.chocolat-right');
    this.off(right, 'click.chocolat');
    this.on(right, 'click.chocolat', () => {
      this.change(+1);
    });
    const left = this.elems.wrapper.querySelector('.chocolat-left');
    this.off(left, 'click.chocolat');
    this.on(left, 'click.chocolat', () => {
      this.change(-1);
    });
    this.off(this.elems.close, 'click.chocolat');
    this.on(this.elems.close, 'click.chocolat', this.close.bind(this));
    this.off(this.elems.fullscreen, 'click.chocolat');
    this.on(this.elems.fullscreen, 'click.chocolat', () => {
      if (this.state.fullScreenOpen) {
        this.state.fullScreenOpen = exitFullScreen();
        return;
      }

      this.state.fullScreenOpen = openFullScreen(this.elems.wrapper);
    });

    if (this.settings.closeOnBackgroundClick) {
      this.off(this.elems.overlay, 'click.chocolat');
      this.on(this.elems.overlay, 'click.chocolat', this.close.bind(this));
    }

    this.off(this.elems.wrapper, 'click.chocolat');
    this.on(this.elems.wrapper, 'click.chocolat', () => {
      if (this.state.initialZoomState === null || !this.state.visible) {
        return;
      }

      this.elems.container.classList.add('chocolat-zooming-out');
      this.zoomOut().then(() => {
        this.elems.container.classList.remove('chocolat-zoomed');
        this.elems.container.classList.remove('chocolat-zooming-out');
      });
    });
    this.off(this.elems.imageWrapper, 'click.chocolat');
    this.on(this.elems.imageWrapper, 'click.chocolat', e => {
      if (this.state.initialZoomState === null && this.elems.container.classList.contains('chocolat-zoomable')) {
        e.stopPropagation();
        this.elems.container.classList.add('chocolat-zooming-in');
        this.zoomIn(e).then(() => {
          this.elems.container.classList.add('chocolat-zoomed');
          this.elems.container.classList.remove('chocolat-zooming-in');
        });
      }
    });
    this.on(this.elems.wrapper, 'mousemove.chocolat', e => {
      if (this.state.initialZoomState === null || !this.state.visible) {
        return;
      }

      const rect = this.elems.wrapper.getBoundingClientRect();
      const pos = {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX
      };
      const height = this.elems.wrapper.clientHeight;
      const width = this.elems.wrapper.clientWidth;
      const imgWidth = this.elems.img.width;
      const imgHeight = this.elems.img.height;
      const coord = [e.pageX - width / 2 - pos.left, e.pageY - height / 2 - pos.top];
      let mvtX = 0;

      if (imgWidth > width) {
        const paddingX = this.settings.zoomedPaddingX(imgWidth, width);
        mvtX = coord[0] / (width / 2);
        mvtX = ((imgWidth - width) / 2 + paddingX) * mvtX;
      }

      let mvtY = 0;

      if (imgHeight > height) {
        const paddingY = this.settings.zoomedPaddingY(imgHeight, height);
        mvtY = coord[1] / (height / 2);
        mvtY = ((imgHeight - height) / 2 + paddingY) * mvtY;
      }

      this.elems.img.style.marginLeft = -mvtX + 'px';
      this.elems.img.style.marginTop = -mvtY + 'px';
    });
    this.on(window, 'resize.chocolat', e => {
      if (!this.state.initialized || !this.state.visible) {
        return;
      }

      debounce(50, () => {
        const fitOptions = {
          imgHeight: this.elems.img.naturalHeight,
          imgWidth: this.elems.img.naturalWidth,
          containerHeight: this.elems.wrapper.clientHeight,
          containerWidth: this.elems.wrapper.clientWidth,
          canvasWidth: this.elems.imageCanvas.clientWidth,
          canvasHeight: this.elems.imageCanvas.clientHeight,
          imageSize: this.settings.imageSize
        };
        const {
          width,
          height
        } = fit(fitOptions);
        this.position(this.elems.img).then(() => {
          this.elems.container.classList.toggle('chocolat-zoomable', this.zoomable(this.elems.img, this.elems.wrapper));
        });
      });
    });
  }

  zoomable(image, wrapper) {
    const wrapperWidth = wrapper.clientWidth;
    const wrapperHeight = wrapper.clientHeight;
    const isImageZoomable = this.settings.allowZoom && (image.naturalWidth > wrapperWidth || image.naturalHeight > wrapperHeight) ? true : false;
    const isImageStretched = image.clientWidth > image.naturalWidth || image.clientHeight > image.naturalHeight;
    return isImageZoomable && !isImageStretched;
  }

  zoomIn(e) {
    this.state.initialZoomState = this.settings.imageSize;
    this.settings.imageSize = 'native';
    return this.position(this.elems.img);
  }

  zoomOut(e) {
    this.settings.imageSize = this.state.initialZoomState || this.settings.imageSize;
    this.state.initialZoomState = null;
    this.elems.img.style.margin = 0;
    return this.position(this.elems.img);
  }

  on(element, eventName, cb) {
    // const eventName = this.settings.setIndex + '-' + eventName
    const length = this.events.push({
      element,
      eventName,
      cb
    });
    element.addEventListener(eventName.split('.')[0], this.events[length - 1].cb);
  }

  off(element, eventName) {
    // const eventName = this.settings.setIndex + '-' + eventName
    const index = this.events.findIndex(event => {
      return event.element === element && event.eventName === eventName;
    });

    if (this.events[index]) {
      element.removeEventListener(eventName.split('.')[0], this.events[index].cb);
      this.events.splice(index, 1);
    }
  }

}

const instances = [];

window.Chocolat = function (elements, options) {
  const settings = Object.assign({}, defaults, {
    images: []
  }, options, {
    setIndex: instances.length
  });
  const instance = new Chocolat(elements, settings);
  instances.push(instance);
  return instance;
};

}());
$(window).load(function(){
  
  if($('.s-comp107 .s-detail-cont .flexslider').length){
    $('.s-comp107 .s-detail-cont .flexslider').flexslider({
      animation: 'slide', animationLoop: true, smoothHeight: false, slideshow: true, slideshowSpeed:8000, pauseOnAction: true, after: function(slider) { if (!slider.playing) { slider.play();}}, pauseOnHover: true, touch: true, controlNav: true, directionNav: true,prevText: '',nextText: '', 
      easing: "swing"
    });
  }

});

$(document).ready(function () {
    if ($('.s-comp90 .s-mfp').length) {
        $('.s-mfp').magnificPopup({
            mainClass: 's-mfp90',
            closeBtnInside: false
        });
    }
});
document.addEventListener('DOMContentLoaded', e => {
    new SM_Masonry({
        id: '11783SmSn1p3T3',
        
        breakpoints: {
            1024: {
    			columnCount: 1,
    			columnGap: 0
    		}
        }
    });
});

$(document).ready(function(){
  if($('.s-comp79 .s-form input.s-datepicker').length){
    $('.s-comp79 .s-form input.s-datepicker').datepicker({autoclose: true, disableTouchKeyboard: true, format:'dd/mm/yyyy', startView: 2, todayHighlight: false, weekStart: 1,  container: 'body'});
  }
});

document.addEventListener('DOMContentLoaded', e => {
    
    const formNodes = Array.prototype.slice.call(document.querySelectorAll('[data-form]'));
    
    formNodes.forEach(formNode => {
        if (formNode.dataset.form === 'smC11783SmSn1p3T2-style') {
            const smForm = new SM_Form(formNode, {
                designMode: true, maxUploadSize: 10000000, showSpecificErrors: true, showReply: `show`, showUrl: `'show'`, sheetsFillEmptyValues: true, 
            });
            
            smForm.mount();
        }
    });
});document.addEventListener('DOMContentLoaded', e => {
    
    const formNodes = Array.prototype.slice.call(document.querySelectorAll('[data-form]'));
    
    formNodes.forEach(formNode => {
        if (formNode.dataset.form === 'smC11783SmSn1p3T2-style') {
            const form = formNode.SM_Form;
            if (form) {
                form.initDatepicker({locale: 'nl', dateFormat: 'j/m/Y', altInput: true, altFormat: 'j/m/Y', defaultDate: 'today', });
            }
        }
    });

});

(function () {
'use strict';

let timerDebounce = undefined;
function debounce(duration, callback) {
  clearTimeout(timerDebounce);
  timerDebounce = setTimeout(function () {
    callback();
  }, duration);
  return timerDebounce;
}
function transitionAsPromise(triggeringFunc, el) {
  return new Promise(resolve => {
    const handleTransitionEnd = () => {
      el.removeEventListener('transitionend', handleTransitionEnd);
      resolve();
    };

    el.addEventListener('transitionend', handleTransitionEnd);
    const classesBefore = el.getAttribute('class');
    const stylesBefore = el.getAttribute('style');
    triggeringFunc();

    if (classesBefore === el.getAttribute('class') && stylesBefore === el.getAttribute('style')) {
      handleTransitionEnd();
    }

    if (parseFloat(getComputedStyle(el)['transitionDuration']) === 0) {
      handleTransitionEnd();
    }
  });
}
function loadImage({
  src,
  srcset,
  sizes
}) {
  const image = new Image();
  image.src = src;

  if (srcset) {
    image.srcset = srcset;
  }

  if (sizes) {
    image.sizes = sizes;
  }

  if ('decode' in image) {
    return new Promise((resolve, reject) => {
      image.decode().then(() => {
        resolve(image);
      }).catch(() => {
        reject(image);
      });
    });
  } else {
    return new Promise((resolve, reject) => {
      image.onload = resolve(image);
      image.onerror = reject(image);
    });
  }
}
function fit(options) {
  let height;
  let width;
  const {
    imgHeight,
    imgWidth,
    containerHeight,
    containerWidth,
    canvasWidth,
    canvasHeight,
    imageSize
  } = options;
  const canvasRatio = canvasHeight / canvasWidth;
  const containerRatio = containerHeight / containerWidth;
  const imgRatio = imgHeight / imgWidth;

  if (imageSize == 'cover') {
    if (imgRatio < containerRatio) {
      height = containerHeight;
      width = height / imgRatio;
    } else {
      width = containerWidth;
      height = width * imgRatio;
    }
  } else if (imageSize == 'native') {
    height = imgHeight;
    width = imgWidth;
  } else {
    if (imgRatio > canvasRatio) {
      height = canvasHeight;
      width = height / imgRatio;
    } else {
      width = canvasWidth;
      height = width * imgRatio;
    }

    if (imageSize === 'scale-down' && (width >= imgWidth || height >= imgHeight)) {
      width = imgWidth;
      height = imgHeight;
    }
  }

  return {
    height: height,
    width: width
  };
}
function openFullScreen(wrapper) {
  if (wrapper.requestFullscreen) {
    wrapper.requestFullscreen();
    return true;
  } else if (wrapper.webkitRequestFullscreen) {
    wrapper.webkitRequestFullscreen();
    return true;
  } else if (wrapper.msRequestFullscreen) {
    wrapper.msRequestFullscreen();
    return true;
  } else {
    return false;
  }
}
function exitFullScreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
    return false;
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
    return false;
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
    return false;
  } else {
    return true;
  }
}

const defaults = {
  container: document.body,
  // window or element
  className: undefined,
  imageSize: 'scale-down',
  // 'scale-down', 'contain', 'cover' or 'native'
  fullScreen: false,
  loop: false,
  linkImages: true,
  setIndex: 0,
  firstImageIndex: 0,
  lastImageIndex: false,
  currentImageIndex: undefined,
  allowZoom: true,
  closeOnBackgroundClick: true,
  setTitle: function () {
    return '';
  },
  description: function () {
    return this.images[this.settings.currentImageIndex].title;
  },
  pagination: function () {
    const last = this.settings.lastImageIndex + 1;
    const position = this.settings.currentImageIndex + 1;
    return position + '/' + last;
  },

  afterInitialize() {},

  afterMarkup() {},

  afterImageLoad() {},

  zoomedPaddingX: function (canvasWidth, imgWidth) {
    return 0;
  },
  zoomedPaddingY: function (canvasHeight, imgHeight) {
    return 0;
  }
};
class Chocolat {
  constructor(elements, settings) {
    this.settings = settings;
    this.elems = {};
    this.images = [];
    this.events = [];
    this.state = {
      fullScreenOpen: false,
      initialZoomState: null,
      initialized: false,
      timer: false,
      visible: false
    };
    this._cssClasses = ['chocolat-open', 'chocolat-in-container', 'chocolat-cover', 'chocolat-zoomable', 'chocolat-zoomed', 'chocolat-zooming-in', 'chocolat-zooming-out'];

    if (NodeList.prototype.isPrototypeOf(elements) || HTMLCollection.prototype.isPrototypeOf(elements)) {
      elements.forEach((el, i) => {
        this.images.push({
          title: el.getAttribute('title'),
          src: el.getAttribute('href'),
          srcset: el.getAttribute('data-srcset'),
          sizes: el.getAttribute('data-sizes')
        });
        this.off(el, 'click.chocolat');
        this.on(el, 'click.chocolat', e => {
          this.init(i);
          e.preventDefault();
        });
      });
    } else {
      this.images = elements;
    }

    if (this.settings.container instanceof Element || this.settings.container instanceof HTMLElement) {
      this.elems.container = this.settings.container;
    } else {
      this.elems.container = document.body;
    }

    this.api = {
      open: i => {
        i = parseInt(i) || 0;
        return this.init(i);
      },
      close: () => {
        return this.close();
      },
      next: () => {
        return this.change(1);
      },
      prev: () => {
        return this.change(-1);
      },
      goto: i => {
        return this.open(i);
      },
      current: () => {
        return this.settings.currentImageIndex;
      },
      position: () => {
        return this.position(this.elems.img);
      },
      destroy: () => {
        return this.destroy();
      },
      set: (property, value) => {
        this.settings[property] = value;
        return value;
      },
      get: property => {
        return this.settings[property];
      },
      getElem: name => {
        return this.elems[name];
      }
    };
  }

  init(i) {
    if (!this.state.initialized) {
      this.markup();
      this.attachListeners();
      this.settings.lastImageIndex = this.images.length - 1;
      this.state.initialized = true;
    }

    this.settings.afterInitialize.call(this);
    return this.load(i);
  }

  load(index) {
    if (!this.state.visible) {
      this.state.visible = true;
      setTimeout(() => {
        this.elems.overlay.classList.add('chocolat-visible');
        this.elems.wrapper.classList.add('chocolat-visible');
      }, 0);
      this.elems.container.classList.add('chocolat-open');
    }

    if (this.settings.fullScreen) {
      this.state.fullScreenOpen = openFullScreen(this.elems.wrapper);
    }

    if (this.settings.currentImageIndex === index) {
      return Promise.resolve();
    }

    let loaderTimer = setTimeout(() => {
      this.elems.loader.classList.add('chocolat-visible');
    }, 1000);
    let fadeOutPromise;
    let image;
    let fadeOutTimer = setTimeout(() => {
      fadeOutTimer = undefined;
      fadeOutPromise = transitionAsPromise(() => {
        this.elems.imageCanvas.classList.remove('chocolat-visible');
      }, this.elems.imageCanvas);
    }, 80);
    return loadImage(this.images[index]).then(loadedImage => {
      image = loadedImage;

      if (fadeOutTimer) {
        clearTimeout(fadeOutTimer);
        return Promise.resolve();
      } else {
        return fadeOutPromise;
      }
    }).then(() => {
      const nextIndex = index + 1;

      if (this.images[nextIndex] != undefined) {
        loadImage(this.images[nextIndex]);
      }

      this.settings.currentImageIndex = index;
      this.elems.description.textContent = this.settings.description.call(this);
      this.elems.pagination.textContent = this.settings.pagination.call(this);
      this.arrows();
      return this.position(image).then(() => {
        this.elems.loader.classList.remove('chocolat-visible');
        clearTimeout(loaderTimer);
        return this.appear(image);
      });
    }).then(() => {
      this.elems.container.classList.toggle('chocolat-zoomable', this.zoomable(image, this.elems.wrapper));
      this.settings.afterImageLoad.call(this);
    });
  }

  position({
    naturalHeight,
    naturalWidth
  }) {
    const fitOptions = {
      imgHeight: naturalHeight,
      imgWidth: naturalWidth,
      containerHeight: this.elems.container.clientHeight,
      containerWidth: this.elems.container.clientWidth,
      canvasWidth: this.elems.imageCanvas.clientWidth,
      canvasHeight: this.elems.imageCanvas.clientHeight,
      imageSize: this.settings.imageSize
    };
    const {
      width,
      height
    } = fit(fitOptions);
    return transitionAsPromise(() => {
      Object.assign(this.elems.imageWrapper.style, {
        width: width + 'px',
        height: height + 'px'
      });
    }, this.elems.imageWrapper);
  }

  appear(image) {
    this.elems.imageWrapper.removeChild(this.elems.img);
    this.elems.img = image;
    this.elems.img.setAttribute('class', 'chocolat-img');
    this.elems.imageWrapper.appendChild(this.elems.img);
    const fadeInPromise = transitionAsPromise(() => {
      this.elems.imageCanvas.classList.add('chocolat-visible');
    }, this.elems.imageCanvas);
    return fadeInPromise;
  }

  change(step) {
    if (!this.state.visible) {
      return;
    }

    this.zoomOut();
    const requestedImage = this.settings.currentImageIndex + parseInt(step);

    if (requestedImage > this.settings.lastImageIndex) {
      if (this.settings.loop) {
        return this.load(this.settings.firstImageIndex);
      }
    } else if (requestedImage < this.settings.firstImageIndex) {
      if (this.settings.loop) {
        return this.load(this.settings.lastImageIndex);
      }
    } else {
      return this.load(requestedImage);
    }
  }

  arrows() {
    if (this.settings.loop) {
      this.elems.left.classList.add('active');
      this.elems.right.classList.add('active');
    } else if (this.settings.linkImages) {
      this.elems.right.classList.toggle('active', this.settings.currentImageIndex !== this.settings.lastImageIndex);
      this.elems.left.classList.toggle('active', this.settings.currentImageIndex !== this.settings.firstImageIndex);
    } else {
      this.elems.left.classList.remove('active');
      this.elems.right.classList.remove('active');
    }
  }

  close() {
    if (this.state.fullScreenOpen) {
      this.state.fullScreenOpen = exitFullScreen();
      return;
    }

    this.state.visible = false;
    const promiseOverlay = transitionAsPromise(() => {
      this.elems.overlay.classList.remove('chocolat-visible');
    }, this.elems.overlay);
    const promiseWrapper = transitionAsPromise(() => {
      this.elems.wrapper.classList.remove('chocolat-visible');
    }, this.elems.wrapper);
    return Promise.all([promiseOverlay, promiseWrapper]).then(() => {
      this.elems.container.classList.remove('chocolat-open');
    });
  }

  destroy() {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const {
        element,
        eventName
      } = this.events[i];
      this.off(element, eventName);
    }

    if (!this.state.initialized) {
      return;
    }

    if (this.state.fullScreenOpen) {
      this.state.fullScreenOpen = exitFullScreen();
    }

    this.settings.currentImageIndex = undefined;
    this.state.visible = false;
    this.state.initialized = false;
    this.elems.container.classList.remove(...this._cssClasses);
    this.elems.wrapper.parentNode.removeChild(this.elems.wrapper);
  }

  markup() {
    this.elems.container.classList.add('chocolat-open', this.settings.className);

    if (this.settings.imageSize == 'cover') {
      this.elems.container.classList.add('chocolat-cover');
    }

    if (this.elems.container !== document.body) {
      this.elems.container.classList.add('chocolat-in-container');
    }

    this.elems.wrapper = document.createElement('div');
    this.elems.wrapper.setAttribute('id', 'chocolat-content-' + this.settings.setIndex);
    this.elems.wrapper.setAttribute('class', 'chocolat-wrapper');
    this.elems.container.appendChild(this.elems.wrapper);
    this.elems.overlay = document.createElement('div');
    this.elems.overlay.setAttribute('class', 'chocolat-overlay');
    this.elems.wrapper.appendChild(this.elems.overlay);
    this.elems.loader = document.createElement('div');
    this.elems.loader.setAttribute('class', 'chocolat-loader');
    this.elems.wrapper.appendChild(this.elems.loader);
    this.elems.layout = document.createElement('div');
    this.elems.layout.setAttribute('class', 'chocolat-layout');
    this.elems.wrapper.appendChild(this.elems.layout);
    this.elems.top = document.createElement('div');
    this.elems.top.setAttribute('class', 'chocolat-top');
    this.elems.layout.appendChild(this.elems.top);
    this.elems.center = document.createElement('div');
    this.elems.center.setAttribute('class', 'chocolat-center');
    this.elems.layout.appendChild(this.elems.center);
    this.elems.left = document.createElement('div');
    this.elems.left.setAttribute('class', 'chocolat-left');
    this.elems.center.appendChild(this.elems.left);
    this.elems.imageCanvas = document.createElement('div');
    this.elems.imageCanvas.setAttribute('class', 'chocolat-image-canvas');
    this.elems.center.appendChild(this.elems.imageCanvas);
    this.elems.imageWrapper = document.createElement('div');
    this.elems.imageWrapper.setAttribute('class', 'chocolat-image-wrapper');
    this.elems.imageCanvas.appendChild(this.elems.imageWrapper);
    this.elems.img = document.createElement('img');
    this.elems.img.setAttribute('class', 'chocolat-img');
    this.elems.imageWrapper.appendChild(this.elems.img);
    this.elems.right = document.createElement('div');
    this.elems.right.setAttribute('class', 'chocolat-right');
    this.elems.center.appendChild(this.elems.right);
    this.elems.bottom = document.createElement('div');
    this.elems.bottom.setAttribute('class', 'chocolat-bottom');
    this.elems.layout.appendChild(this.elems.bottom);
    this.elems.close = document.createElement('span');
    this.elems.close.setAttribute('class', 'chocolat-close');
    this.elems.top.appendChild(this.elems.close);
    this.elems.description = document.createElement('span');
    this.elems.description.setAttribute('class', 'chocolat-description');
    this.elems.bottom.appendChild(this.elems.description);
    this.elems.pagination = document.createElement('span');
    this.elems.pagination.setAttribute('class', 'chocolat-pagination');
    this.elems.bottom.appendChild(this.elems.pagination);
    this.elems.setTitle = document.createElement('span');
    this.elems.setTitle.setAttribute('class', 'chocolat-set-title');
    this.elems.setTitle.textContent = this.settings.setTitle();
    this.elems.bottom.appendChild(this.elems.setTitle);
    this.elems.fullscreen = document.createElement('span');
    this.elems.fullscreen.setAttribute('class', 'chocolat-fullscreen');
    this.elems.bottom.appendChild(this.elems.fullscreen);
    this.settings.afterMarkup.call(this);
  }

  attachListeners() {
    this.off(document, 'keydown.chocolat');
    this.on(document, 'keydown.chocolat', e => {
      if (this.state.initialized) {
        if (e.keyCode == 37) {
          this.change(-1);
        } else if (e.keyCode == 39) {
          this.change(1);
        } else if (e.keyCode == 27) {
          this.close();
        }
      }
    });
    const right = this.elems.wrapper.querySelector('.chocolat-right');
    this.off(right, 'click.chocolat');
    this.on(right, 'click.chocolat', () => {
      this.change(+1);
    });
    const left = this.elems.wrapper.querySelector('.chocolat-left');
    this.off(left, 'click.chocolat');
    this.on(left, 'click.chocolat', () => {
      this.change(-1);
    });
    this.off(this.elems.close, 'click.chocolat');
    this.on(this.elems.close, 'click.chocolat', this.close.bind(this));
    this.off(this.elems.fullscreen, 'click.chocolat');
    this.on(this.elems.fullscreen, 'click.chocolat', () => {
      if (this.state.fullScreenOpen) {
        this.state.fullScreenOpen = exitFullScreen();
        return;
      }

      this.state.fullScreenOpen = openFullScreen(this.elems.wrapper);
    });

    if (this.settings.closeOnBackgroundClick) {
      this.off(this.elems.overlay, 'click.chocolat');
      this.on(this.elems.overlay, 'click.chocolat', this.close.bind(this));
    }

    this.off(this.elems.wrapper, 'click.chocolat');
    this.on(this.elems.wrapper, 'click.chocolat', () => {
      if (this.state.initialZoomState === null || !this.state.visible) {
        return;
      }

      this.elems.container.classList.add('chocolat-zooming-out');
      this.zoomOut().then(() => {
        this.elems.container.classList.remove('chocolat-zoomed');
        this.elems.container.classList.remove('chocolat-zooming-out');
      });
    });
    this.off(this.elems.imageWrapper, 'click.chocolat');
    this.on(this.elems.imageWrapper, 'click.chocolat', e => {
      if (this.state.initialZoomState === null && this.elems.container.classList.contains('chocolat-zoomable')) {
        e.stopPropagation();
        this.elems.container.classList.add('chocolat-zooming-in');
        this.zoomIn(e).then(() => {
          this.elems.container.classList.add('chocolat-zoomed');
          this.elems.container.classList.remove('chocolat-zooming-in');
        });
      }
    });
    this.on(this.elems.wrapper, 'mousemove.chocolat', e => {
      if (this.state.initialZoomState === null || !this.state.visible) {
        return;
      }

      const rect = this.elems.wrapper.getBoundingClientRect();
      const pos = {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX
      };
      const height = this.elems.wrapper.clientHeight;
      const width = this.elems.wrapper.clientWidth;
      const imgWidth = this.elems.img.width;
      const imgHeight = this.elems.img.height;
      const coord = [e.pageX - width / 2 - pos.left, e.pageY - height / 2 - pos.top];
      let mvtX = 0;

      if (imgWidth > width) {
        const paddingX = this.settings.zoomedPaddingX(imgWidth, width);
        mvtX = coord[0] / (width / 2);
        mvtX = ((imgWidth - width) / 2 + paddingX) * mvtX;
      }

      let mvtY = 0;

      if (imgHeight > height) {
        const paddingY = this.settings.zoomedPaddingY(imgHeight, height);
        mvtY = coord[1] / (height / 2);
        mvtY = ((imgHeight - height) / 2 + paddingY) * mvtY;
      }

      this.elems.img.style.marginLeft = -mvtX + 'px';
      this.elems.img.style.marginTop = -mvtY + 'px';
    });
    this.on(window, 'resize.chocolat', e => {
      if (!this.state.initialized || !this.state.visible) {
        return;
      }

      debounce(50, () => {
        const fitOptions = {
          imgHeight: this.elems.img.naturalHeight,
          imgWidth: this.elems.img.naturalWidth,
          containerHeight: this.elems.wrapper.clientHeight,
          containerWidth: this.elems.wrapper.clientWidth,
          canvasWidth: this.elems.imageCanvas.clientWidth,
          canvasHeight: this.elems.imageCanvas.clientHeight,
          imageSize: this.settings.imageSize
        };
        const {
          width,
          height
        } = fit(fitOptions);
        this.position(this.elems.img).then(() => {
          this.elems.container.classList.toggle('chocolat-zoomable', this.zoomable(this.elems.img, this.elems.wrapper));
        });
      });
    });
  }

  zoomable(image, wrapper) {
    const wrapperWidth = wrapper.clientWidth;
    const wrapperHeight = wrapper.clientHeight;
    const isImageZoomable = this.settings.allowZoom && (image.naturalWidth > wrapperWidth || image.naturalHeight > wrapperHeight) ? true : false;
    const isImageStretched = image.clientWidth > image.naturalWidth || image.clientHeight > image.naturalHeight;
    return isImageZoomable && !isImageStretched;
  }

  zoomIn(e) {
    this.state.initialZoomState = this.settings.imageSize;
    this.settings.imageSize = 'native';
    return this.position(this.elems.img);
  }

  zoomOut(e) {
    this.settings.imageSize = this.state.initialZoomState || this.settings.imageSize;
    this.state.initialZoomState = null;
    this.elems.img.style.margin = 0;
    return this.position(this.elems.img);
  }

  on(element, eventName, cb) {
    // const eventName = this.settings.setIndex + '-' + eventName
    const length = this.events.push({
      element,
      eventName,
      cb
    });
    element.addEventListener(eventName.split('.')[0], this.events[length - 1].cb);
  }

  off(element, eventName) {
    // const eventName = this.settings.setIndex + '-' + eventName
    const index = this.events.findIndex(event => {
      return event.element === element && event.eventName === eventName;
    });

    if (this.events[index]) {
      element.removeEventListener(eventName.split('.')[0], this.events[index].cb);
      this.events.splice(index, 1);
    }
  }

}

const instances = [];

window.Chocolat = function (elements, options) {
  const settings = Object.assign({}, defaults, {
    images: []
  }, options, {
    setIndex: instances.length
  });
  const instance = new Chocolat(elements, settings);
  instances.push(instance);
  return instance;
};

}());


$(document).ready(function(){
    
    var headerHeight = 0;
    var adaptiveHeight = false ;
    
    if (adaptiveHeight) {
        headerHeight = $("header.s-header-1").outerHeight(true);
        $(".hero-banner-1").css("height","calc(100vh - " + headerHeight + "px)");
    }
    
});

$(document).ready(function() {
if($(".s-comp69 .owl-carousel").length){
  var owl = $(".s-comp69 .owl-carousel");
    owl.owlCarousel({
      responsive:{0:{items:2},600:{items:4},1000:{items:4}}, margin:30, loop:true, mouseDrag:true, touchDrag:true, nav:true, navText:['',''], slideBy: 1, autoplay:true, autoplayTimeout: 5000, autoplaySpeed: 1500, 
    });
}
});

$(document).ready(function(){

    $('.s-comp78 .flexslider.s-thumbnails .slides > li, .s-comp78 .flexslider.s-slider.slide-cover .slides > li, .s-comp78 .flexslider.s-slider.slide-contain .slides > li').each(function() {
        var imgSrc = $(this).find('img').attr('src');
        $(this).css('background', 'url("' + imgSrc + '")');
        $(this).find('img').hide();
        $(this).css('background-position', 'initial');
    });

    // Fade in background images

    setTimeout(function() {
        $('.s-comp78 .flexslider.s-slider .slides > li').each(function() {
            $(this).addClass('fadeIn');
        });
    }, 200);

  $(".s-comp78 div.flexslider.mainslider").addClass(function(index) {return "mainslider-id" + index;});
  $(".s-comp78 div.flexslider.lightslider").addClass(function(index) {return "lightslider-id" + index;});
  $(".s-comp78 div.flexslider.thumbslider").addClass(function(index) {return "thumbslider-id" + index;});
  $(".s-comp78 div.flexslider.s-thumbnails").addClass(function(index) {return "thumbslider-id" + index;});

  $('.s-comp78 div.flexslider .s-content-onslider').each(function(){
    $(this).closest('.s-comp78 div.flexslider').prepend(this);
    $(this).wrapInner('<div class="row"></div>');
  });

  if ( $('.s-comp78 div.flexslider.s-thumbnails').length ){
    $('.s-comp78 div.flexslider.s-thumbnails .s-slider-content').hide();
  }

  $('.flexslider.lightslider').each(function(i){
    $(this).find('ul.slides li > a').attr('rel','prettyPhoto[gal'+ i +']');
  });

});
$(window).load(function(){
  
  if($('.s-comp78 .mainslider').length){
    $('.s-comp78 .mainslider').flexslider({
      animation: 'slide', animationLoop: true, smoothHeight: true, slideshow: true, slideshowSpeed:6000, pauseOnAction: true, after: function(slider) { if (!slider.playing) { slider.play();}}, touch: false, controlNav: true, directionNav: true,prevText: '',nextText: '', 
      easing: "swing"
    });
  }  // Thumbnails

  if($('.s-comp78 .flexslider.s-thumbnails').length){

    $('.s-comp78 .flexslider.s-thumbnails').each(function(index){

      var c1 = '.s-comp78 .flexslider.s-thumbnails.thumbslider-id'+index;
      var c2 = '.s-comp78 .s-slider.thumbslider.thumbslider-id'+index;

      console.log(c1);
      console.log(c2);

      $(c1).flexslider({
        animation: 'slide', directionNav: true, itemWidth:250, itemMargin:0, 
        easing: "swing",
        controlNav: false,
        animationLoop: false,
        slideshow: false,
        asNavFor: c2
      });      // Thumbnail Slider
        
        $(c2).flexslider({
          animation: 'slide', direction: 'horizontal', animationLoop: true, slideshow: false, 
          sync: c1
        });

    }); 
  }  // Lightbox Slider

    if($('.s-comp78 .lightslider').length){
      $('.s-comp78 .lightslider').flexslider({
        animation: 'slide', animationLoop: true, smoothHeight: true, slideshow: true, slideshowSpeed:7000, pauseOnAction: true, after: function(slider) { if (!slider.playing) { slider.play();}}, touch: false, directionNav: true,prevText: '',nextText: '', 
        easing: "swing",
        init: function(){
          $(".s-comp78 .lightslider .clone a").removeAttr("rel"); 
        }
      });
    }

  if(($('.s-comp78 .flexslider.thumbslider').length) || ($('.s-comp78 .mainslider').length) || ($('.s-comp78 .lightslider').length)){
    $('.s-comp78 .flex-direction-nav li a').html("");
  }

});  

$(window).ready(function(){
  if($('.s-comp43 .testimonial-slider').length){
    $('.s-comp43 .testimonial-slider').flexslider({
      animation: 'slide', smoothHeight: false, slideshow: true, slideshowSpeed:7000, animationSpeed:1000, touch: true, controlNav: true, directionNav: true, 
      easing: "swing"
    });
    $('.s-comp43 .testimonial-slider .flex-direction-nav li a').html("");
  }
});  
  


const checkEnvironment = () => {
    const url = new URL(window.location.href);
    const page = url.searchParams.get("page");
    const layID = url.searchParams.get("layID");
    
    const isCMS = page !== null && page === 'vcmspage.php';
    const isDesign = url.pathname.includes('preview.php') && layID !== null;
    const isLocal = isCMS || isDesign;
    const isPreview = isLocal ? false : url.hostname.includes('sitemn.gr');
    const projectPath = typeof cleanURL_path !== 'undefined' ? cleanURL_path : url.searchParams.get("SM_User") ? `/users/${url.searchParams.get("SM_User")}` : url.pathname.split('/').filter((path, i) => i <= 2).join('/');

    return {
       local: isLocal,
       env: isCMS ? 'cms' : isDesign ? 'design' : isPreview ? 'preview' : 'live',
       baseUrl: `${url.hostname}${projectPath}`
    };
};

class SM_Filter {
    constructor(wrapper = false, options = false) {
        if (wrapper && !this._isElement(wrapper)) {
            wrapper = document.querySelector(wrapper);
        }
        
        if (!wrapper) {
            console.error('SM_Filter error => No wrapper element found');
            return;
        }
        
        this.wrapper = wrapper;
        
        this._defaults = {
            overview: {
                selector: '.s-overview',
                rendersettingsDataAttribute: 'rendersettings',
                filtersDataAttribute: 'selectedfilters',
                error: {
                    text: 'Geen resultaten',
                    defaults: ['s-text', 'no-results']
                }
            },
            filterbar: {
                active: true,
                selector: '.s-filterbar',
                categories: {
                    dataAttribute: 'cats',
                    parent: 0,
                    active: 0,
                    showAll: {
                        active: true,
                        text: ''
                    }
                },
                buttons: {
                    defaults: ['s-btn', 's-btn__filter'],
                    active: 's-active',
                }
            },
            loadmore: {
                active: true,
                parent: '',
                defaults: ['s-btn', 's-load__more'],
                hidden: 's-hidden',
                text: 'Load More'
            }
        };

        this._options = options ? this._deepMerge(this._defaults, options) : this._defaults;
        this._options.loadmore.parent = this._options.loadmore.parent === '' ? this.wrapper : this._options.loadmore.parent;
        
        this.overview = wrapper.querySelector(this._options.overview.selector);
        
        try {
            this.rendersettings = JSON.parse(this.overview.dataset[this._options.overview.rendersettingsDataAttribute]);
            this.selectedfilters = JSON.parse(this.overview.dataset[this._options.overview.filtersDataAttribute]);
        } catch(e) {
            console.error('SM_Filter error => There is an error in your rendersettings or selectedfilters data');
            return;
        }
        
        /* CMS and Design Fix*/
        this.rendersettings.list_filters = this.rendersettings.list_filters || this.selectedfilters.map(filter => 'filter_' + filter.id + ' = `' + filter.value + '` AND ').join('');
        this.rendersettings.sw_var_lid = this.rendersettings.sw_var_lid || sw_var_lid;
        
        /* Remove Session */
        this.rendersettings.session = false;
        
        this.rendersettingsStart = JSON.stringify(this.rendersettings);
        
        this._environment = checkEnvironment();
        this.loadmoreUrl = this._environment.local ? '../../../cmsfiles/loadmore.php' : `//${this._environment.baseUrl}swfiles/lib/loadmore.php`;
        
        this._events = {};
        
        /*Functionality*/
        if (this._options.filterbar.active || this._options.loadmore.active) {
            this.initEvents();
        }
        
        /*Load More*/
        if (this._options.loadmore.active) {
            this.initLoadmore();
        }
        
        /*Filterbar*/
        if (this._options.filterbar.active) {
            this.filterbar = this.wrapper.querySelector(this._options.filterbar.selector);
            this.initFilterbar();
        }
    }
    
    /********************/
    /* Helper functions */
    /********************/
    
    _isElement(element) {
        return element instanceof Element || element instanceof HTMLDocument;  
    }
    
    _deepMerge(arr) {
        const argl = arguments.length;
        let retObj;

        if (Object.prototype.toString.call(arr) === '[object Array]') {
            retObj = [];
            for (let p in arr) {
                retObj.push(arr[p]);
            }
        } else {
            retObj = {};
            for (let p in arr) {
                retObj[p] = arr[p];
            }
        }

        for (let i = 1; i < argl; i++) {
            for (let p in arguments[i]) {
                if (retObj[p] && typeof retObj[p] === 'object') {
                    retObj[p] = this._deepMerge(retObj[p], arguments[i][p]);
                } else {
                    retObj[p] = arguments[i][p];
                }
            }
        }

        return retObj;
    }
    
    _formatFilters(arr, parent = false) {
        arr.forEach((cat, i, arr) => cat.sub_categories = arr.filter(el => cat.id === el.prev_category));
        return parent ? arr.find(main => main.id == parent) : arr[0];
    }
    
    _objectToUrl(obj) { 
        if(!obj) return obj;
        return Object.keys(obj).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`).join('&');
    }
    
    _fetchData(url, data, type = 'POST') {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(type, url, true);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            
            xhr.onload = () => {
                if (xhr.status === 200) {
                   resolve(xhr.responseText);
                } else {
                   reject({
                        status: xhr.status,
                        statusText: xhr.statusText,
                        responseText : xhr.responseText
                    });
                }
             };
    
             xhr.onerror = function() {
                reject(Error('There was a network error.'));
             };
            
            xhr.send(data);
        });
    }
    
    /***********/
    /* Methods */
    /***********/
    
    _createButton(id, value, isActive = false) {
        const {defaults, active} = this._options.filterbar.buttons;
        const button = document.createElement('button');
        
        if (isActive) button.classList.add(active);
        
        defaults.forEach(cls => {
            button.classList.add(cls);
        });
        
        button.textContent = value;
        button.value = id;
        
        return button;
    }
    
    _createErrorMessage() {
        const {text, defaults} = this._options.overview.error;
        const message = document.createElement('div');
        
        defaults.forEach(cls => {
            message.classList.add(cls);
        });
        
        message.textContent = text;
        
        return message;
    }
    
    _deleteErrorMessage() {
        if (!this.error) return;
        
        this.error.remove();
        this.error = false;
    }
    
    initFilterbar() {
        const {dataAttribute, parent, active, showAll} = this._options.filterbar.categories;
        const categoriesString = this.filterbar.dataset[dataAttribute];
        
        if (!categoriesString) {
            console.error('SM_Filter error => No categories provided');
            return;
        }
        
        const categories = this._formatFilters(JSON.parse(categoriesString), parent);
        
        if (!categories) {
            console.error('SM_Filter error => Categories could not be parsed');
            return;
        }
        
        if (showAll.active) {
            const name = this._options.filterbar.categories.showAll.text === '' ? categories.name : this._options.filterbar.categories.showAll.text;
            const isActive = active == categories.id || active == 0;
            const activeBtn = this._createButton(categories.id, name, isActive);
            this.filterbar.append(activeBtn);
        }
        
        categories.sub_categories.forEach(sub => {
            const isActive = active == sub.id;
            const button = this._createButton(sub.id, sub.name, isActive);
            this.filterbar.append(button);
            
            if (isActive) button.click();
        });
    }
    
    checkLoadmore() {
        const rendersettings = JSON.parse(this.rendersettingsStart);
        const showAll = parseInt(rendersettings.list_nr) === 0;
        
        if (showAll) {
            this.loadmore.classList.add(this._options.loadmore.hidden);
            return;
        }
        
        rendersettings.pageno = parseInt(rendersettings.list_nr) + 1;
        rendersettings.list_nr = 1;
        
        this._fetchData(this.loadmoreUrl, this._objectToUrl(rendersettings))
            .then(response => {
                const data = JSON.parse(response);
                const html = data.html;
                
                if (html !== ''){
                    this.loadmore.classList.remove(this._options.loadmore.hidden);
                } else {
                    this.loadmore.classList.add(this._options.loadmore.hidden);
                }
            }).catch(err => console.error(err));
    }
    
    initLoadmore() {
        const {parent, defaults, text} = this._options.loadmore;
        
        const loadmore = document.createElement('button');
        defaults.forEach(cls => {
            loadmore.classList.add(cls);
        });
        
        loadmore.textContent = text;
        
        let banner = parent;
        if (!this._isElement(banner)) {
            banner = this.wrapper.parentElement.querySelector(parent);
            
            if (!banner) {
                console.error('SM_Filter error => No load more parent found');
                return;
            }
        }
        
        banner.append(loadmore);
        this.loadmore = loadmore;
        
        this.checkLoadmore();
    }
    
    initEvents() {
        document.addEventListener('click', e => {
            const source = e.target;
            const wrapper = source.closest(`.${[...this.wrapper.classList].join('.')}`);
            
            if (!wrapper) return;
            
            if (this._options.filterbar.active) {
                const {defaults, active} = this._options.filterbar.buttons;
                const filterButton = source.closest(`.${defaults.join('.')}`);
                
                if (filterButton) {
                    const activeId = filterButton.value;
                    const previousActiveButton = this.filterbar.querySelector(`.${defaults.join('.')}.${active}`);
                    
                    
                    if (previousActiveButton) previousActiveButton.classList.remove(active);
                    
                    filterButton.classList.add(active);
                    
                    this.rendersettings = JSON.parse(this.rendersettingsStart);
                    this.rendersettings.list_cat += ` AND cat_${activeId}`;

                    this.loadEntries('replace');
                }
            }
            
            if (this._options.loadmore.active) {
                const loadmore = source.closest(`.${this._options.loadmore.defaults.join('.')}`);
                
                if (loadmore) {
                    this.rendersettings.pageno = parseInt(this.rendersettings.pageno) + 1;
                
                    this.loadEntries('add');
                }
            }
        });
    }
    
    loadEntries(type) {
        const addEntries = type === 'add';
        const {active: loadmoreActive, hidden} = this._options.loadmore;
        
        this._fetchData(this.loadmoreUrl, this._objectToUrl(this.rendersettings))
            .then(response => {
                const data = JSON.parse(response);
                const html = data.html;
                
                if (html !== '') {
                    if (addEntries) {
                        this.overview.insertAdjacentHTML('beforeend', html);
                    } else {
                        this.overview.innerHTML = html;
                    }
                    
                    if (this._events.change) {
                        this.emit('change', type);
                    }
    
                    if (loadmoreActive) {
                        if (data.empty) {
                            this.loadmore.classList.add(hidden);
                        } else {
                            this.loadmore.classList.remove(hidden);
                        }
                    }
                    
                    this._deleteErrorMessage();
                } else {
                    this.overview.innerHTML = '';
                    if (loadmoreActive) this.loadmore.classList.add(hidden);
                    
                    if (this._events.change) {
                        this.emit('change', 'empty');
                    }
    
                    this.error = this._createErrorMessage();
                    this.overview.append(this.error);
                }
            }).catch(err => console.error(err));
    }
    
    /**********/
    /* Events */
    /**********/
    
    on(name, listener) {
        if (!this._events[name]) {
            this._events[name] = [];
        }
        
        this._events[name].push(listener);
    }
    
    removeListener(name, listenerToRemove) {
        if (!this._events[name]) {
            throw new Error(`Can't remove a listener. Event "${name}" doesn't exits.`);
        }
    
        const filterListeners = (listener) => listener !== listenerToRemove;
        
        this._events[name] = this._events[name].filter(filterListeners);
    }
    
    emit(name, data) {
        if (!this._events[name]) {
            throw new Error(`Can't emit an event. Event "${name}" doesn't exits.`);
        }
        
        const fireCallbacks = (callback) => {
            callback(data);
        };
        
        this._events[name].forEach(fireCallbacks);
    }
}

document.addEventListener("DOMContentLoaded", (e) => {
    const comps = document.getElementsByClassName("s-comp95");
    [...comps].forEach((comp) => {
        const wrapper = comp.getElementsByClassName("db-wrapper")[0];
        const sm_Filter = new SM_Filter(wrapper, {
            overview: {
                selector: ".db-overview" /*optional -> default s-overview*/
            },
            filterbar: {
                selector: ".db-filter",
                categories: {
                    showAll: {
                        text: wrapper.dataset.all
                    },
                },
                buttons: {
                    defaults: ['filter-btn', 's-btn__filter']
                }
            },
        });
        sm_Filter.on("change", (type) => {
            console.log(`Overview has changed with type ${type}`); /*Event example -> types add/replace/empty */
        });
    });
});
$(document).ready(function() {
    
    $(".article--card").each( function(index) {
    
        /****************************
            SHOW TAGS
        ****************************/
        var tag = $(this).data("dbcat-1");
        $(this).find(".article--card-tags").text(tag);
    
        /****************************
            DATE FORMAT
        ****************************/
        var date = $(this).find(".date").text().split('/');
        date = date[2] + '/' + date[1] + '/' + date[0].slice(-2);
        $(this).find(".date").text(date);
        
    }); // end each
    
});


$(document).ready(function() {
if($(".s-comp98 .owl-carousel").length){
  var owl = $(".s-comp98 .owl-carousel");
    owl.owlCarousel({
      responsive:{0:{items:3},600:{items:3},1000:{items:4}}, margin:30, loop:true, mouseDrag:true, touchDrag:true, nav:true, navText:['',''], slideBy: 1, autoplay:true, autoplayTimeout: 5000, autoplaySpeed: 1500, 
    });
}
});

document.addEventListener('DOMContentLoaded', e => {
    new SM_Counter({
        id: '19022SmSn1p3T4',
        invokeInView: true, animationDuration: 3000, easingFunction: 'easeInOutCubic', 
    });
});

$(document).ready(function() {
    const swiper = new Swiper('.testimonial-slider-container.small .swiper-container', {
      // Optional parameters
      loop: true,
      centeredSlides: true,
      effect: 'slide',
      speed: 500,
    
      // If we need pagination
      pagination: {
        el: '.swiper-pagination',
        type: 'bullets',
        clickable: 'yes',
      },
    
      // Navigation arrows
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
    
    });
});


$(document).ready(function() {

    /* INITIALIZE */
    
    let contentContainer = $(".s-comp105 .content-container");
    $(".s-comp105 .tabs-list .tab-container:first-child").addClass("active");
    let tabImage = $(".s-comp105 .tabs-list .tab-container:first-child .tab-inner").data("image");
    contentContainer.find("img").attr("src", tabImage);
    
    /* PRELOAD IMAGES */
    
    $(".s-comp105 .tab-inner").each(function () {
        img = new Image();
        img.src = $(this).attr("data-image");
    });
    
    /* CLICK TRIGGER */
    
    $(".s-comp105 .tabs-list .tab-container").hover(function() {
        $(".s-comp105 .tabs-list .tab-container.active").removeClass("active");
        $(this).addClass("active");
        let tabImage = $(this).find(".tab-inner").data("image");
        contentContainer.find("img").attr("src", tabImage);
    });

});


$(document).ready(function() {
    const swiper = new Swiper('.testimonial-slider-container.large .swiper-container', {
      // Optional parameters
      loop: true,
      centeredSlides: true,
      effect: 'fade',
      speed: 800,
    
      // If we need pagination
      pagination: {
        el: '.swiper-pagination',
        type: 'bullets',
        clickable: 'yes',
      },
    
      // Navigation arrows
      navigation: {
        nextEl: '.swiper-nav-next',
        prevEl: '.swiper-nav-prev',
      },
    
    });
});


document.addEventListener('DOMContentLoaded', e => {
    new SM_Accordion({
        id: '16908SmSn1p3T14i140',
        forceClose: true, singleActive: false, 
    });
});

$(document).ready(function() {
    const swiper = new Swiper('.feature-slider-container .swiper-container', {
        loop: false,
        centeredSlides: false,
        effect: 'slide',
        watchSlidesProgress: true,
        speed: 800,
        slidesPerView: 2,
        slidesPerGroup: 1,
        spaceBetween: 30,
          
        breakpoints: {
            320: {
                slidesPerView: 1,
                slidesPerGroup: 1,
                slidesOffsetBefore: 0,
                slidesOffsetAfter: 0,
            },
            480: {
                slidesPerView: 1,
                slidesPerGroup: 1,
                slidesOffsetBefore: 0,
                slidesOffsetAfter: 0,
            },
            991: {
                slidesPerView: 2,
                slidesPerGroup: 1,
                slidesOffsetBefore: 0,
                slidesOffsetAfter: 0,
            },
            1280: {
                slidesPerView: 2,
                slidesPerGroup: 2,
                slidesOffsetBefore: 0,
                slidesOffsetAfter: 0,
            }
        },
        // Pagination
        pagination: {
            el: '.swiper-pagination',
            type: 'bullets',
            clickable: 'yes',
        },
        
        // Navigation arrows
        navigation: {
            nextEl: '.swiper-nav-next',
            prevEl: '.swiper-nav-prev',
        },
    
    });
});


$(document).ready(function(){
  $('.s-comp115 .flexslider.s-thumbnails .slides > li, .s-comp115 .flexslider.s-slider.slide-cover .slides > li, .s-comp115 .flexslider.s-slider.slide-contain .slides > li').each(function() {
      var imgSrc = $(this).find('img').attr('src');
      $(this).css('background', 'url("' + imgSrc + '")');
      $(this).find('img').hide();
      $(this).css('background-position', 'initial');
  });

  // Fade in background images

  setTimeout(function() {
      $('.s-comp115 .flexslider.s-slider .slides > li').each(function() {
          $(this).addClass('fadeIn');
      });
  }, 200);
});
$(window).load(function(){
  
  if($('.s-comp115 .s-detail-cont .flexslider').length){
    $('.s-comp115 .s-detail-cont .flexslider').flexslider({
      animation: 'slide', animationLoop: true, smoothHeight: false, slideshow: true, slideshowSpeed:8000, pauseOnAction: true, after: function(slider) { if (!slider.playing) { slider.play();}}, pauseOnHover: true, touch: true, controlNav: true, directionNav: true,prevText: '',nextText: '', 
      easing: "swing"
    });
  }

});

document.addEventListener('DOMContentLoaded', e => {
    
    const formNodes = Array.prototype.slice.call(document.querySelectorAll('[data-form]'));
    
    formNodes.forEach(formNode => {
        if (formNode.dataset.form === 'smC11783SmSn1p3T2i8i2-style') {
            const smForm = new SM_Form(formNode, {
                designMode: true, maxUploadSize: 10000000, showSpecificErrors: true, showReply: `show`, showUrl: `'show'`, 
            });
            
            smForm.mount();
        }
    });
});document.addEventListener('DOMContentLoaded', e => {
    
    const formNodes = Array.prototype.slice.call(document.querySelectorAll('[data-form]'));
    
    formNodes.forEach(formNode => {
        if (formNode.dataset.form === 'smC11783SmSn1p3T2i8i2-style') {
            const form = formNode.SM_Form;
            if (form) {
                form.initDatepicker({locale: 'nl', dateFormat: 'j/m/Y', altInput: true, altFormat: 'j/m/Y', defaultDate: 'today', });
            }
        }
    });

});

