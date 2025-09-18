// 引入基础组件类
const BaseComponent = require("../tools/baseComponent.js");
// 从工具模块中引入所需的工具、组件列表、运行时数据、索引数据库数据和功能配置
const { tools, componentList, runtimeData, indexDBData, feature_config } = require("../tools/tools.js");


// 时间转换为24小时制
class profileLocalTimeConvertTo24 extends BaseComponent {
  /**
   * 构造函数，初始化组件的基本信息
   */
  constructor() {
    super();
    // 组件名称
    this.name = "当地时间转换为24小时制";
    // 组件描述
    this.describe = "公司资料页面中的 当地时间 自动从12小时制转换为24小时制 *增加了對英文的支持";
    // 组件启用状态
    this.enable = true;
    // 组件是否可禁用
    this.canDisable = true;
    // 组件标签列表
    this.tagList = ['样式','实用'];
  }
  // 组件数据，用于存储最近一次的编辑结果
  componentData = {
    lastText:"", // 最近一次的编辑结果
  }
  // 通用功能列表，包含匹配条件和对应的执行函数
  commonFuncList = [{
    // 匹配当前页面URL是否符合特定格式
    match: () => Boolean(location.href.match(/company\/(0|1)\/.*\//)),
    // 匹配成功时执行的函数
    func: this.mainFunc
  }]


  /**
   * 主功能函数，负责将公司资料页面中的当地时间从12小时制转换为24小时制
   */
  mainFunc() {
    // 获取页面中特定选择器对应的所有元素
    // 原选择器会获取页面中所有 div > table > tbody > tr 下的 td 元素，
    // 为了能更精准地处理，这里通过为元素添加更具标识性的选择条件，
    // 可以先获取包含 “当地时间” 标签的 td 元素，以此分辨不同的 tbody 内容
    let elements = document.querySelectorAll('div > table > tbody > tr > td');
    let element;
    // 如果未找到任何元素，直接返回
    if (elements.length == 0) return;
    // 遍历所有元素，查找文本为“当地时间”的元素
    for (let i = 0; i < elements.length; i++) {
      if (!['当地时间', 'Local time'].includes(elements[i].innerText)) continue;
      // 找到后获取其下一个元素
      element = elements[i + 1];
      break;
    }
    // 尝试将元素文本从12小时制转换为24小时制，转换失败则保持原文本
    let result = tools.convert12To24Hr(element.innerText) ? tools.convert12To24Hr(element.innerText) : element.innerText;
    // 如果转换结果与上次相同，直接返回
    if (result == this.componentData.lastText) return;
    // 更新最近一次的编辑结果
    this.componentData.lastText = result;
    // 将转换结果更新到页面元素中
    element.innerText = result;
  }
}
// 创建组件实例
new profileLocalTimeConvertTo24();
