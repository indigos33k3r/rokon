import {
  uid,
  loadImage,
  isPowerOf2,
  mergeRSMCanvae,
  loadImageAsCanvas,
  getImageBinaryData
} from "../utils";

/**
 * A basic texture
 * @class ObjectTexture
 */
export default class ObjectTexture {
  /**
   * @param {Object} opts
   * @constructor
   */
  constructor(opts = {}) {
    this.uid = uid();
    this.gl = opts.gl;
    this.renderer = opts.renderer;
    this.binary = !!opts.binary;
    this.pixelated = !!opts.pixelated;
    this.onload = opts.onload || null;
    // texture options
    {
      let gl = this.gl;
      if (!opts.wrap) opts.wrap = {};
      if (!opts.flip) opts.flip = {};
      if (!opts.scale) opts.scale = {};
      this.wrap = {
        s: opts.wrap.s || gl.MIRRORED_REPEAT,
        t: opts.wrap.t || gl.MIRRORED_REPEAT,
        r: opts.wrap.r || gl.MIRRORED_REPEAT
      };
      this.flip = {
        x: !!opts.flip.x,
        y: !!opts.flip.y
      };
      this.scale = {
        x: opts.scale.x !== void 0 ? opts.scale.x : 1.0,
        y: opts.scale.x !== void 0 ? opts.scale.y : 1.0
      };
      this.mips = opts.mips !== void 0 ? opts.mips : true;
    }
    this._loaded = false;
    this.data = null;
    this.native = null;
    this.sourcePath = null;
    this.sourceElement = null;
  }
  get loaded() {
    return this._loaded;
  }
  set loaded(value) {
    this._loaded = value;
    if (this.loaded) {
    // fire onload callback if necessary
      if (this.onload instanceof Function) this.onload(this);
    }
  }
};

/**
 * Sets the active/used texture
 * @param {WebGLTexture} texture
 */
ObjectTexture.prototype.setTexture = function(texture) {
  this.native = texture;
};

/**
 * Attaches the given binary data representation
 * @param {Uint8Array} data
 */
ObjectTexture.prototype.setBinaryData = function(data) {
  this.data = data;
};

/**
 * Returns the active texture
 * @return {WebGLFrameBuffer}
 */
ObjectTexture.prototype.getActiveTexture = function() {
  let gl = this.gl;
  return gl.getParameter(gl.TEXTURE_BINDING_2D);
};

/**
 * Returns the native texture
 * @return {WebGLTexture}
 */
ObjectTexture.prototype.getNativeTexture = function() {
  return this.native;
};

/**
 * Creates a new empty texture
 * @return {WebGLTexture}
 */
ObjectTexture.prototype.createTexture = function() {
  let gl = this.gl;
  let previous = this.getActiveTexture();
  let texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.bindTexture(gl.TEXTURE_2D, previous);
  return texture;
};

/**
 * Creates a new empty texture
 * @param {HTMLImageElement|HTMLCanvasElement} element
 * @param {WebGLTexture} texture
 * @param {Boolean} anisotropic
 */
ObjectTexture.prototype.readImageIntoTexture = function(element, texture, anisotropic = false) {
  let gl = this.gl;
  let previous = this.getActiveTexture();
  let pixelated = this.pixelated;
  let pot = isPowerOf2(element.width) && isPowerOf2(element.height);
  let wrap = this.wrap;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // use anisotropic filtering
  if (anisotropic) {
    let ext = this.renderer.getExtension("EXT_texture_filter_anisotropic");
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
  }
  if (!pixelated) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  if (this.flip.y) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, element.width, element.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, element);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap.s);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap.t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_R, wrap.r);
  if (pot && !pixelated) {
    if (this.mips) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_LOD, -0.4);
  }
  else {
    if (pixelated) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  }
  // enable mip mapping
  if (pot && !pixelated && this.mips) gl.generateMipmap(gl.TEXTURE_2D);
  // create binary data representation
  if (this.binary) {
    let data = null;
    if (element instanceof HTMLImageElement) {
      data = getImageBinaryData(element);
    }
    else if (element instanceof HTMLCanvasElement) {
      let ctx = element.getContext("2d");
      data = ctx.getImageData(0, 0, element.width, element.height).data;
    }
    else {
      console.warn(`Cannot resolve binary data for`, element.constructor.name);
    }
    this.setBinaryData(data);
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.bindTexture(gl.TEXTURE_2D, previous);
};

/**
 * Creates a texture from a canvas element
 * @param {HTMLCanvasElement} canvas
 * @return {ObjectTexture}
 */
ObjectTexture.prototype.fromCanvas = function(canvas) {
  let gl = this.gl;
  let texture = this.createTexture();
  this.wrap = {
    s: gl.CLAMP_TO_EDGE,
    t: gl.CLAMP_TO_EDGE,
    r: gl.REPEAT
  };
  this.readImageIntoTexture(canvas, texture);
  this.loaded = true;
  this.setTexture(texture);
  this.sourceElement = canvas;
  return this;
};

/**
 * Creates a texture from a image element
 * @param {HTMLImageElement} img
 * @return {ObjectTexture}
 */
ObjectTexture.prototype.fromImage = function(img) {
  let gl = this.gl;
  let texture = this.createTexture();
  this.readImageIntoTexture(img, texture);
  this.loaded = true;
  this.setTexture(texture);
  this.sourceElement = img;
  return this;
};

/**
 * Creates a texture from an image path
 * @param {String} path
 * @return {ObjectTexture}
 */
ObjectTexture.prototype.fromImagePath = function(path) {
  let gl = this.gl;
  let texture = this.createTexture();
  this.loaded = false;
  loadImage(path).then(img => {
    this.readImageIntoTexture(img, texture);
    this.loaded = true;
    this.sourcePath = path;
    this.sourceElement = img;
  });
  this.setTexture(texture);
  return this;
};

/**
 * Creates a texture from the given color
 * @param {Array} color
 * @return {ObjectTexture}
 */
ObjectTexture.prototype.fromColor = function(color) {
  let gl = this.gl;
  let texture = this.createTexture();
  let previous = this.getActiveTexture();
  let r = color[0];
  let g = color[1];
  let b = color[2];
  let a = color.length <= 3 ? 255 : color[3];
  let data = new Uint8Array([r, g, b, a]);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.bindTexture(gl.TEXTURE_2D, previous);
  this.setTexture(texture);
  if (this.binary) this.setBinaryData(data);
  this.sourceElement = null;
  this.loaded = true;
  return this;
};

/**
 * Creates a single RSM texture from 3 texture inputs
 * @param {Object} opts
 * @return {ObjectTexture}
 */
ObjectTexture.prototype.fromRSM = function(opts = {}) {
  let renderer = this.renderer;
  // set default texture
  this.fromColor([0, 0, 0]);
  loadImageAsCanvas(opts.R).then(canvasR => {
    loadImageAsCanvas(opts.S).then(canvasS => {
      loadImageAsCanvas(opts.M).then(canvasM => {
        let buffer = mergeRSMCanvae(canvasR, canvasS, canvasM);
        this.fromCanvas(buffer.canvas);
        if (
          (canvasR.width  !== canvasS.width)  ||
          (canvasR.width  !== canvasM.width)  ||
          (canvasS.width  !== canvasM.width)  ||
          (canvasR.height !== canvasS.height) ||
          (canvasR.height !== canvasM.height) ||
          (canvasS.height !== canvasM.height)
        ) console.assert(`RSM textures differ in sizes! Expected ${canvasR.width}x${canvasR.height}`);
      });
    });
  });
  return this;
};
