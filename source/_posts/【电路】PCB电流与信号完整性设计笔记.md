---
title: 【电路】PCB电流与信号完整性设计笔记
tags:
  - PCB
  - 电路
categories: 理论
cover: 'https://s2.loli.net/2024/10/24/VBEajFwLUJbD39t.png'
abbrlink: 2e5f328
date: 2024-10-07 15:46:31
mathjax: true
---

# PCB电流与信号完整性设计笔记

## 基本的电流概念

### 介电常数

电子在铜导线中的传输速度理论上是光速。

但问题是电流流过导体，会在导体周围产生电磁场，`电磁场和电流必须一起移动`，而磁场的移动速度是受到导体周围介质的影响的。
$$
信号传播速度 = 11.8/\sqrt{\varepsilon_r}    \rm in/ns
$$
$$
\varepsilon_r是相对介电常数，也就是空气（真空）的介电常数，\varepsilon_r=1
$$

像我们常用的PCB材料`FR4`的相对介电常数约为4，那套这个公式就是：
$$
FR4信号传播速度 = 11.8/2 \approx6    \rm in/ns
$$
传输速度远小于在空气介质中。

### 走线宽度和信号传输速度

信号线越粗，传输速度越慢。

因为走线变宽走线和参考层之间就有更多磁场线包在介质中。

### 微带线和带状线

<img src="/sly_blog/img/photos/wdx.webp" alt="微带线" style="zoom:100%;" />

<img src="/sly_blog/img/photos/dzx.webp" alt="带状线" style="zoom:100%;" />

* 微带线就是一面是空气，另一面是参考层（应该是GND平面）的PCB信号线。

* 带状线就是两面都是参考层的信号线。

### 数字电路的时序问题

* RGB屏的信号线，要确保三种信号同时到达接收器。
* 差分对两条信号线必须等长。
* 当时钟脉冲触发时，数据线的正确电平必须出现并稳定在各自端口。

解决这一问题的方法：`蛇形走线`，确保等长。

## 实际PCB走线tips

1. 走线距离同层的地铜皮≥三倍线宽

   <img src="https://s2.loli.net/2024/10/23/jkmfMItQUB8VRgY.png" alt="微带线" style="zoom:100%;" />

2. 避免高速信号跨区。一般高速线距离参考平面边缘大于40mil，但是实际案例一般是做不到。

<img src="https://s2.loli.net/2024/10/23/tvr7n3oC4NhVPOQ.png" alt="微带线" style="zoom:70%;" />

3. 芯片、ESD器件的每个GND焊盘附近都打一个GND通孔，并且尽量靠近焊盘。
4. 避免在晶振周围、开关电源、磁类器件（电感）周围布线。

5. 差分线等长：绕线补偿

<img src="https://s2.loli.net/2024/10/23/DmotdeYX67wFZ1p.png" alt="微带线" style="zoom:70%;" />

差分线对称：

<img src="https://s2.loli.net/2024/10/24/aSBxvsZdCGlJWc5.png" alt="微带线" style="zoom:80%;" />

6. 完整地平面：`因为只有大面积且完整的铜箔才能提供阻抗极小的高频回流路径`。

7. 回流地过孔：下图是不同频率的信号线下电流的分布密度。

   <img src="https://s2.loli.net/2024/10/24/oGSNxOquiwImUF3.png" alt="微带线" style="zoom:30%;" />

伴地过孔的打法：

<img src="https://s2.loli.net/2024/10/24/kAZTOg2Dna7Wi4w.png" alt="微带线" style="zoom:100%;" />

应用：uart串口线旁边：（其实RX右边也要打一个）

<img src="https://s2.loli.net/2024/10/24/XhMxFjm6oHE9sWG.png" alt="微带线" style="zoom:60%;" />

8. 地铜皮不要超过地焊盘：

   <img src="https://s2.loli.net/2024/10/24/k2TJ1i5nuOhN7Lp.png" alt="微带线" style="zoom:70%;" />

9. 重要的时钟信号、复位信号建议包地，包地线间隔500mil至少打一个地过孔，包地线距离信号线是3W。包地线线宽可取4mil~10mil。

10. 蛇形走线建议形态：

    <img src="https://s2.loli.net/2024/10/24/Sy4QA3drqghfxk9.png" alt="微带线" style="zoom:70%;" />

11. 尽量减小残桩长度，尽量为0。

    <img src="https://s2.loli.net/2024/10/24/KGtq5f3czSeuryR.png" alt="微带线" style="zoom:70%;" />

12. 信号线一般是4mil。

13. 纠正错误理念：`以下的通过过孔的直角走线是允许的：`

<img src="https://s2.loli.net/2024/10/24/8lcTN7x6nPvCGJa.png" alt="微带线" style="zoom:70%;" />

`以下的走线中间插过孔是被允许的：`

<img src="https://s2.loli.net/2024/10/24/Uuwo4lnrhdmACSj.png" alt="微带线" style="zoom:90%;" />

14. 信号+电源的过孔一般取0.4mm · 0.2mm，被简称为0402过孔，每个0402过孔大概能走0.4A的电流。所以走电源线要打孔时一般要多个过孔+铺铜。

15. 大于30mil就不走线了，都改铺铜，那怎么确定线宽呢？ctrl+m（快捷键可能要自己设置）测量铺铜宽度并实时修改达到约数值即可：

    <img src="https://s2.loli.net/2024/10/24/yI4bKQx8X2U1sau.png" alt="微带线" style="zoom:80%;" />

16. 芯片的电源pin尽量等于芯片焊盘的宽度，大于等于8mil，但是不能大于焊盘本身的宽度。
