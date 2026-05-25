---
title: C语言与数据结构的入门与持续精进
tags:
  - C
  - 数据结构
categories: 理论
cover: 'https://s2.loli.net/2024/10/06/m9sbRf7deYPAS4X.png'
abbrlink: f50b84c9
date: 2024-10-06 15:46:31
---

# vscode配置C语言环境
MinGW-W64 GCC下载链接：

{% link MinGW-W64 GCC百度网盘下载，提取码unfm, https://pan.baidu.com/s/1ltlbxroX7v1SPZu1IPp9Zg %}


# 基础语法

## 字符串

### string库

strlen函数测量字符串长度：strlen(s)传入头指针。

# 指针

## 指针基础语法

{% folding green open, 来自CSDN-唐大麦 %}

```c
int p; //这是一个普通的整型变量
int *p; //首先从P 处开始,先与*结合,所以说明P 是一个指针,然后再与int 结合,说明指针所指向的内容的类型为int 型.所以P是一个返回整型数据的指针
int p[3]; //首先从P 处开始,先与[]结合,说明P 是一个数组,然后与int 结合,说明数组里的元素是整型的,所以P 是一个由整型数据组成的数组
int *p[3]; //首先从P 处开始,先与[]结合,因为其优先级比*高,所以P 是一个数组,然后再与*结合,说明数组里的元素是指针类型,然后再与int 结合,说明指针所指向的内容的类型是整型的,所以P 是一个由返回整型数据的指针所组成的数组
int (*p)[3]; //首先从P 处开始,先与*结合,说明P 是一个指针然后再与[]结合(与"()"这步可以忽略,只是为了改变优先级),说明指针所指向的内容是一个数组,然后再与int 结合,说明数组里的元素是整型的.所以P 是一个指向由整型数据组成的数组的指针
int **p; //首先从P 开始,先与*结合,说是P 是一个指针,然后再与*结合,说明指针所指向的元素是指针,然后再与int 结合,说明该指针所指向的元素是整型数据.由于二级指针以及更高级的指针极少用在复杂的类型中,所以后面更复杂的类型我们就不考虑多级指针了,最多只考虑一级指针.
int p(int); //从P 处起,先与()结合,说明P 是一个函数,然后进入()里分析,说明该函数有一个整型变量的参数,然后再与外面的int 结合,说明函数的返回值是一个整型数据
int (*p)(int); //从P 处开始,先与指针结合,说明P 是一个指针,然后与()结合,说明指针指向的是一个函数,然后再与()里的int 结合,说明函数有一个int 型的参数,再与最外层的int 结合,说明函数的返回类型是整型,所以P 是一个指向有一个整型参数且返回类型为整型的函数的指针
int *(*p(int))[3]; //可以先跳过,不看这个类型,过于复杂从P 开始,先与()结合,说明P 是一个函数,然后进入()里面,与int 结合,说明函数有一个整型变量参数,然后再与外面的*结合,说明函数返回的是一个指针,,然后到最外面一层,先与[]结合,说明返回的指针指向的是一个数组,然后再与*结合,说明数组里的元素是指针,然后再与int 结合,说明指针指向的内容是整型数据.所以P 是一个参数为一个整数据且返回一个指向由整型指针变量组成的数组的指针变量的函数.
```

{% endfolding %}

上面就已经把指针的语法说得相当明白了，无非就是各种符号的优先级问题，`优先级 () > [] > *`，哪一个符号先与变量结合，然后是哪一个，这样子再复杂的指针复合体也能迎刃而解。

## 指针结合地址

指针，当然会指向一个地方。

指针具体指向一个`地址`，这个地址我们就以stm32单片机为例，stm32内核是32位的系统，所以地址就是32位的，比如`0x12345678`，就是一个32位的地址，也就是4个字节。所以32位系统的指针都是4个字节的。

* 32位系统中char占1个字节。

* 32位系统中short占2个字节。

* 32位系统中int占4个字节。

## 指针的算术运算

{% folding green open, 来自CSDN-唐大麦 %}

```c
char a[20];
int *p=(int *)a; //强制类型转换并不会改变a 的类型
p++;
```

p是一个int类型的指针。

a是字符数组的头指针，a的类型是`char *`，强制转换为`int *`并赋值给p。

重点来了：`p++之后，指针p指向哪里？`

这里并不是执行p+1，而编译器执行的真正操作是`p+sizeof(int)`。

因为p是int型的指针，int 占4 个字节。由于地址是用字节做单位的，故p所指向的地址向高地址方向增加了4 个字节。

由于char 类型的长度是一个字节，所以，原来p是指向数组a[0]，p++之后指向的是a[4]。

{% endfolding %}

## 指针运算符&和*

{% folding green open, 来自自己 %}

在我看指针运算符时一直是用的下面的方式：

```c
int a = 4, b;
int *p;

p = &a;	//&是取地址
b = *p; //*是取内容
```

{% endfolding %}

## 数组和指针的关系

```c
int array[10]={0,1,2,3,4,5,6,7,8,9},value;
value=array[0]; //也可写成：value=*array;
value=array[3]; //也可写成：value=*(array+3);
value=array[4]; //也可写成：value=*(array+4);
```

这个比较简单了，主要是记住数组名就代表数组头指针就行了。

## 二级指针

{% folding green open, 来自CSDN-唐大麦 %}

```c
int a, b;
int array[10];
int *pa;
int **ptr;

pa = &a;
ptr = &pa;	//pa是int型指针，&pa就是指针的指针
*ptr = &b;	//二级指针取内容，就是一个一级指针
```

数组的二级指针例子：

```c
char *arr[20];	//arr是char*指针类型的数组
char **parr = arr;
```

{% endfolding %}

## 字符串的指针表示（未来可能移动到字符串节）

{% folding green open, 来自CSDN-唐大麦 %}

```c
char *str[3]={
    "Hello,thisisasample!",
    "Hi,goodmorning.",
    "Helloworld"
};
char s[80]；
strcpy(s,str[0]); //也可写成strcpy(s,*str);
strcpy(s,str[1]); //也可写成strcpy(s,*(str+1));
strcpy(s,str[2]); //也可写成strcpy(s,*(str+2));
```

记录一下字符串的表示方法，这种表示方法之前我见到过，但是后面忘记了。

{% endfolding %}

## 字符串与结构体

`重点！`

{% folding green open, 来自CSDN-唐大麦 %}

```c
struct MyStruct
{
    int a;
    int b;
    int c;
};
struct MyStruct ss={20,30,40};
//声明了结构对象ss，并把ss的成员初始化为20，30 和40。
struct MyStruct *ptr=&ss;
//声明了一个指向结构对象ss 的指针。它的类型是
//MyStruct *,它指向的类型是MyStruct。
```

通过指针访问结构体成员变量：

```c
ptr->a;
ptr->b;
ptr->c;
```

{% endfolding %}

## 函数和指针的关系

{% folding green open, 来自自己 %}

```c
int fun(char *,int);
int (*pfun)(char *,int);	//pfun是个函数指针
pfun=fun;
int a=(*pfun)("abcdefg",7); //用运算符*取内容，后面加上形参就能调用函数了。
```

{% endfolding %}

## 指针类型转换

{% folding green open, 来自自己 %}

举例，int类型的指针变成char类型指针：

```c
unsigned int a;
a=0x12345678;//表示一个具体地址
char *ptr;
ptr=(char*)a;
```

举例：指针具体数值的提取：

```c
int a=123,b;
int *ptr=&a;
char *str;
b=(int)ptr; 	//把指针ptr 的值当作一个整数取出来。
str=(char*)b; 	//把这个整数的值当作一个地址赋给指针str。
```

{% endfolding %}

## 指针安全

{% folding green open, 来自CSDN-唐大麦 %}

```c
char s='a';
int *ptr;
ptr=(int *)&s;
*ptr=1298;
```

指针原先是char型，只选定了一个字节，这样强制转换成int型导致指针选定了这个字节连带后面三个字节，总共四个字节。

假如后三个字节里原本存储着重要内容，那这一操作就有一定的危险。

{% endfolding %}

## 指针实用操作

### 函数传入数组与返回数组

一个数组要想传入函数内，或者被函数return出来，那么只能是利用函数的头指针。

例如力扣第一题两数之和：

```c
int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    for(int i=0; i<numsSize; i++)
    {
        for(int j=i+1; j<numsSize; j++)
        {
            if(nums[i] + nums[j] == target)
            {
                int *ans = malloc(sizeof(int)*2);
                ans[0] = i;
                ans[1] = j;
                *returnSize = 2;
                return ans;
            }
        }
    }
    *returnSize = 0;
    return NULL;
```

导入的数组是nums，导出的数组是ans。

为什么不能int ans[2];呢？而是要用malloc申请内存？

因为函数的返回值是数组，`也就是需要返回一个指针`。

`而局部变量的指针是无法被函数返回的。`，所以要么把ans数组拿出去，变成全局变量，要么就申请内存。

# 数据结构

## 链表

{% folding green open, 内存就像黑暗森林 %}

```c
#include<stdio.h>

struct ListNode {
    int val;
    struct ListNode *next;
};

void main()
{
    struct ListNode* l1 = malloc(sizeof(struct ListNode));
    struct ListNode* l2 = malloc(sizeof(struct ListNode));
    l1->val = 2;
    l2->val = 6;
    l1->next = l2;
    printf("%d\r\n",l1->val);
    printf("%d\r\n",l1->next->val);
    printf("%d\r\n",(int)l1->next->next);
    printf("%d\r\n",(int)NULL);
    if (l1->next->next==NULL)
    {
        printf("111");
    }
    
}
```

输出的结果是：

```
2
6
8126800
0
```

所以初始化节点一定要做到每个节点的每个成员都初始化，NULL也是人为赋予的，不是系统自动的。

{% endfolding %}

{% folding green open, 来自我的力扣 %}

第二题的两个倒序链表相加：

```c
/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     struct ListNode *next;
 * };
 */


struct ListNode* addTwoNumbers(struct ListNode* l1, struct ListNode* l2) {
    struct ListNode* head=NULL;
    struct ListNode* node=NULL;
    int carry = 0;
    while(l1 || l2)
    {
        int c1 = l1? l1->val : 0;
        int c2 = l2? l2->val : 0;
        if(head==NULL)
        {
            head = node = malloc(sizeof(struct ListNode));
            node->val = (c1+c2+carry)%10;
            node->next = NULL;
        }
        else
        {
            node->next = malloc(sizeof(struct ListNode));
            node = node->next;
            node->val = (c1+c2+carry)%10;
            node->next = NULL;
        }
        if(l1)l1 = l1->next;
        if(l2)l2 = l2->next;

        carry = (c1+c2+carry)/10;
    }
    if(carry!=0)
    {
        node->next = malloc(sizeof(struct ListNode));//这四步其实可以看作一步，就简单了很多,代码模块化
        node = node->next;
        node->val = carry;
        node->next = NULL;
    }
    return head;
}
```

其实稍微复习一下，语法就能记起来了。

```c
head = node = malloc(sizeof(struct ListNode));
```

上面这句我甚至还想了一段时间。head是个指针，指向的就是`node这个链表头节点的地址`。

### 初始化节点

```c
node->next = malloc(sizeof(struct ListNode));//这四步其实可以看作一步，就简单了很多,代码模块化
node = node->next;
node->val = carry;
node->next = NULL;
```

这几句是一成不变的，必须连在一起，

三步初始化节点：

1. `给节点指针申请内存`

2. `节点连接`

3. `赋值`



`然后写算法一定要打草稿。`



{% endfolding %}

# 算法

## 滑动窗口算法

该算法的适用关键词是：`子串`。

各种找怎么怎么样的子串都可以用这个算法。

`子串问题套用这个算法就可以简化为：滑动窗口的左端和右端位置锁定的问题`。

以下是**精炼的算法核心**：

* 如果当前子串不符合要求：`扩展右端`。
* 如果当前子串    符合要求：`收缩左端`。

比如力扣第三题：无重复字符的最长子串。

{% folding green open, 来自我的力扣 %}

```c
#define max(a,b) a>b? a : b

int lengthOfLongestSubstring(char* s) {

    int left = 0,length = 0,max_l = 0;
    for(int right=0; s[right];right++)
    {
        for(int i=left ; i<right ; i++)
        {
            if(s[i]==s[right])
            {
                left=i+1;       
            }

        }
        length = right+1 - left;
        max_l = max(length,max_l);
    }
    return max_l;
    
}
```

{% endfolding %}

## 遍历

比如找最长的回文子串这种，必须要把所有可能的子串全部遍历出来。

```c
    for(int i=0; i<n; i++)//R边界遍历
    {
        for(int j=0; j<i; j++)//L边界遍历
        {
            //得到[L,R]的子串
            int L = j;
            int R = i;
        }
    }
```

第一个循环遍历右边界，第二个循环遍历左边界。
