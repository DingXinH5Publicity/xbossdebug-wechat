import utils from "./utils";

let Report = supperclass =>
  class extends supperclass {
    constructor(options) {
      super(options);
      this.errorQueue = []; // 记录错误队列
      this.repeatList = {}; // 记录重复异常数据
      this.url = this.config.url;
      ["log", "debug", "info", "warn", "error"].forEach((type, index) => {
        this[type] = msg => {
          return this.handleMsg(msg, type, index);
        };
      });
    }
    // 重复出现的错误，只上报config.repeat次
    repeat(error) {
      let rowNum = error.rowNum || "";
      let colNum = error.colNum || "";
      let repeatName = error.msg + rowNum + colNum;
      this.repeatList[repeatName] = this.repeatList[repeatName]
        ? this.repeatList[repeatName] + 1
        : 1;
      return this.repeatList[repeatName] > this.config.repeat;
    }
    // 忽略错误
    except(error) {
      let oExcept = this.config.except;
      let result = false;
      let v = null;
      if (utils.typeDecide(oExcept, "Array")) {
        for (let i = 0, len = oExcept.length; i < len; i++) {
          v = oExcept[i];
          if (
            (utils.typeDecide(v, "RegExp") && v.test(error.msg)) ||
            (utils.typeDecide(v, "Function") && v(error, error.msg))
          ) {
            result = true;
            break;
          }
        }
      }
      return result;
    }
    // 请求服务端
    request(url, params, cb) {
      if (!this.config.key) {
        console.warn("please set key in xbossdebug.config.key");
        return;
      }
      params.key = this.config.key
      wx.request({
        url: url,
        method: 'POST',
        data: params,
        success: cb
      });
    }
    report(cb) {
      let mergeReport = this.config.mergeReport;
      if (this.errorQueue.length === 0) return this.url;
      let curQueue = mergeReport ? this.errorQueue : [this.errorQueue.shift()];
      if (mergeReport) this.errorQueue = [];
      let url = this.url;
      let params = {err_msg: curQueue, systemInfo: this.systemInfo, breadcrumbs: this.breadcrumbs, locationInfo: this.locationInfo}
      this.request(url, params, () => {
        if (cb) {
          cb.call(this);
        }
        this.trigger("afterReport");
      });
      return url;
    }
    // 发送
    send(cb) {
      if (!this.trigger("beforeReport")) return;
      let callback = cb || utils.noop;
      let delay = this.config.mergeReport ? this.config.delay : 0;
      setTimeout(() => {
        this.report(callback);
      }, delay);
    }
    // push错误到pool
    catchError(error) {
      var rnd = Math.random();
      if (rnd >= this.config.random) {
        return false;
      }
      if (this.repeat(error)) {
        return false;
      }
      if (this.except(error)) {
        return false;
      }
      this.errorQueue.push(error);
      return this.errorQueue;
    }
    // 手动上报
    handleMsg(msg, type, level) {
      if (!msg) {
        return false;
      }
      let errorMsg = utils.typeDecide(msg, "Object") ? msg : { msg: msg };
      errorMsg.level = level;
      errorMsg.type = type;
      errorMsg = utils.assignObject({}, errorMsg);
      if (this.catchError(errorMsg)) {
        this.send();
      }
      return errorMsg;
    }
  };

export default Report;
